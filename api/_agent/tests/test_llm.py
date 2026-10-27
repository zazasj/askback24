import json

import httpx
import pytest

from _agent.llm import EnnoiaLlm, FakeLlm, LlmError, extract_json, llm_from_env

ENV = {"ENNOIA_PROJECT": "P", "ENNOIA_API_KEY": "K", "ENNOIA_AGENT_ID_FAST": "FASTID", "ENNOIA_AGENT_ID": "SHARED"}


def ok_body(text, parts=None):
    content = parts if parts is not None else [{"type": "text", "text": text}]
    return {
        "id": "x",
        "object": "chat.completion.chunk",
        "model": "openai/gpt-6.1-sol",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content, "tool_calls": []}, "finish_reason": "stop"}],
    }


def make(handler, env=ENV):
    return EnnoiaLlm(env, httpx.AsyncClient(transport=httpx.MockTransport(handler)))


async def test_sends_ennoia_headers_and_body():
    seen = {}

    def handler(req):
        seen["url"], seen["h"], seen["body"] = str(req.url), req.headers, json.loads(req.content)
        return httpx.Response(200, json=ok_body('{"a": 1}'))

    r = await make(handler).complete_json("fast", "S", "U", timeout_s=5)
    assert seen["url"] == "https://api.ennoia.so/api/multi-agents/chat/FASTID/latest/completions/dispatch"
    assert seen["h"]["project"] == "P" and seen["h"]["apiKey"] == "K"
    assert seen["body"]["multiAgentId"] == "FASTID" and seen["body"]["multiAgentVersion"] == "latest"
    assert seen["body"]["messages"][0] == {"role": "system", "content": [{"type": "text", "text": "S"}]}
    assert seen["body"]["messages"][1] == {"role": "user", "content": [{"type": "text", "text": "U"}]}
    assert r.data == {"a": 1} and r.model == "openai/gpt-6.1-sol"


async def test_role_falls_back_to_shared_agent_id():
    seen = {}

    def handler(req):
        seen["url"] = str(req.url)
        return httpx.Response(200, json=ok_body("{}"))

    await make(handler).complete_json("accurate", "S", "U", timeout_s=5)
    assert "/chat/SHARED/latest/" in seen["url"]


async def test_missing_key_is_not_configured():
    calls = []

    def handler(req):
        calls.append(req)
        return httpx.Response(200, json=ok_body("{}"))

    env = {k: v for k, v in ENV.items() if k != "ENNOIA_API_KEY"}
    with pytest.raises(LlmError) as e:
        await make(handler, env).complete_json("fast", "S", "U", timeout_s=5)
    assert e.value.code == "not_configured" and calls == []


async def test_http_error_status():
    with pytest.raises(LlmError) as e:
        await make(lambda req: httpx.Response(500, text="secret body")).complete_json("fast", "S", "U", timeout_s=5)
    assert e.value.code == "http_status" and "secret" not in str(e.value)


async def test_timeout():
    def handler(req):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(LlmError) as e:
        await make(handler).complete_json("fast", "S", "U", timeout_s=5)
    assert e.value.code == "timeout"


async def test_non_json_body_and_missing_choices():
    with pytest.raises(LlmError) as e:
        await make(lambda req: httpx.Response(200, text="<html>")).complete_json("fast", "S", "U", timeout_s=5)
    assert e.value.code == "not_json"
    with pytest.raises(LlmError) as e:
        await make(lambda req: httpx.Response(200, json={"x": 1})).complete_json("fast", "S", "U", timeout_s=5)
    assert e.value.code == "not_json"


async def test_joins_multiple_text_parts():
    parts = [{"type": "text", "text": '{"a":'}, {"type": "text", "text": " 1}"}]
    r = await make(lambda req: httpx.Response(200, json=ok_body("", parts))).complete_json("fast", "S", "U", timeout_s=5)
    assert r.data == {"a": 1}


def test_extract_json_fenced():
    assert extract_json('```json\n{"q": 1}\n```') == {"q": 1}


def test_extract_json_with_prose():
    assert extract_json('결과입니다.\n{"q": [1]}\n끝') == {"q": [1]}


def test_extract_json_bad():
    with pytest.raises(LlmError):
        extract_json("JSON 없음")


async def test_fake_llm_pops_records_and_raises():
    f = FakeLlm([{"a": 1}, LlmError("timeout")])
    r = await f.complete_json("fast", "S", "U", timeout_s=3)
    assert r.data == {"a": 1} and r.model == "fake"
    assert f.calls == [{"role": "fast", "system": "S", "user": "U", "timeout_s": 3}]
    with pytest.raises(LlmError):
        await f.complete_json("fast", "S", "U", timeout_s=3)


async def test_fake_llm_delay_beyond_timeout():
    f = FakeLlm([{"a": 1}], delay_s=0.2)
    with pytest.raises(LlmError) as e:
        await f.complete_json("fast", "S", "U", timeout_s=0.01)
    assert e.value.code == "timeout"


def test_llm_from_env():
    assert isinstance(llm_from_env(ENV), EnnoiaLlm)
