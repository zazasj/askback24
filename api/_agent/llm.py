import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Literal, Mapping, Protocol

import httpx

Role = Literal["fast", "accurate"]
ErrorCode = Literal["not_configured", "http_status", "timeout", "not_json"]

_MESSAGES: dict[str, str] = {
    "not_configured": "llm not configured",
    "http_status": "llm http error",
    "timeout": "llm timeout",
    "not_json": "llm response is not json",
}
_URL = "https://api.ennoia.so/api/multi-agents/chat/{agent_id}/latest/completions/dispatch"


@dataclass
class LlmResult:
    data: Any
    model: str


class LlmError(Exception):
    """메시지는 코드별 고정 문구. 키·프롬프트·응답 본문을 넣지 않는다."""

    def __init__(self, code: ErrorCode) -> None:
        super().__init__(_MESSAGES[code])
        self.code: ErrorCode = code


class Llm(Protocol):
    async def complete_json(self, role: Role, system: str, user: str, timeout_s: float) -> LlmResult: ...


def extract_json(text: str) -> Any:
    s = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", s, re.DOTALL)
    for cand in ([fence.group(1).strip()] if fence else []) + [s]:
        try:
            return json.loads(cand)
        except ValueError:
            pass
    start = s.find("{")
    if start >= 0:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(s)):
            ch = s[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(s[start : i + 1])
                    except ValueError:
                        break
    raise LlmError("not_json")


class EnnoiaLlm:
    def __init__(self, env: Mapping[str, str], client: httpx.AsyncClient | None = None) -> None:
        self._env = env
        self._client = client

    def _agent_id(self, role: Role) -> str:
        key = "ENNOIA_AGENT_ID_FAST" if role == "fast" else "ENNOIA_AGENT_ID_ACCURATE"
        return self._env.get(key) or self._env.get("ENNOIA_AGENT_ID") or ""

    async def complete_json(self, role: Role, system: str, user: str, timeout_s: float) -> LlmResult:
        project, key, agent_id = self._env.get("ENNOIA_PROJECT"), self._env.get("ENNOIA_API_KEY"), self._agent_id(role)
        if not (project and key and agent_id):
            raise LlmError("not_configured")
        body = {
            "multiAgentId": agent_id,
            "multiAgentVersion": "latest",
            "messages": [
                {"role": "system", "content": [{"type": "text", "text": system}]},
                {"role": "user", "content": [{"type": "text", "text": user}]},
            ],
        }
        headers = {
            "project": project,
            "apiKey": key,
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
        }
        client = self._client or httpx.AsyncClient()
        try:
            res = await client.post(
                _URL.format(agent_id=agent_id),
                headers=headers,
                content=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                timeout=httpx.Timeout(timeout_s),
            )
        except httpx.TimeoutException:
            raise LlmError("timeout") from None
        except httpx.HTTPError:
            raise LlmError("http_status") from None
        finally:
            if self._client is None:
                await client.aclose()
        if res.status_code >= 400:
            raise LlmError("http_status")
        try:
            payload = res.json()
            content = payload["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LlmError("not_json") from None
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            text = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        else:
            raise LlmError("not_json")
        model = payload.get("model") if isinstance(payload, dict) else None
        return LlmResult(data=extract_json(text), model=model or "unknown")


class FakeLlm:
    def __init__(self, responses: list[Any], delay_s: float = 0) -> None:
        self._responses = list(responses)
        self._delay_s = delay_s
        self.calls: list[dict] = []

    async def complete_json(self, role: Role, system: str, user: str, timeout_s: float) -> LlmResult:
        self.calls.append({"role": role, "system": system, "user": user, "timeout_s": timeout_s})
        await asyncio.sleep(min(self._delay_s, timeout_s))
        if self._delay_s > timeout_s:
            raise LlmError("timeout")
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return LlmResult(data=item, model="fake")


def llm_from_env(env: Mapping[str, str]) -> Llm:
    return EnnoiaLlm(env)
