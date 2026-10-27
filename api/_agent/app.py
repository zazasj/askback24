import asyncio
import hmac
import logging
import os
from collections.abc import Mapping

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from pathlib import Path

from .checks import load_card_labels
from .errors import ApiError
from .graphs.first import FirstAgent
from .llm import Llm, LlmError, llm_from_env
from .schemas import FirstRequest, FirstResponse

PREFIX = "/api/ai/v1"
# TS 의 20초(WARMUP_TIMEOUT_MS)보다 먼저 끝내 ok 값이 로그에 닿게 한다.
WARMUP_S = 15.0
_HTTP_CODES = {404: "not_found", 405: "method_not_allowed"}


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


def _make_auth(env: Mapping[str, str]):
    def check_key(request: Request) -> None:
        key = env.get("AI_API_KEY")
        if not key:
            # 키가 없으면 로컬(VERCEL_ENV 없음)만 통과한다. 배포 환경은 키 누락도 막는다.
            if env.get("VERCEL_ENV") in ("production", "preview"):
                raise ApiError(401, "unauthorized", "invalid api key")
            return
        got = request.headers.get("authorization", "")
        if not hmac.compare_digest(got.encode(), f"Bearer {key}".encode()):
            raise ApiError(401, "unauthorized", "invalid api key")

    return check_key


def _setup_logging() -> None:
    # basicConfig 는 root 를 INFO 로 올려 httpx 요청 줄까지 찍으므로, 우리 로거만 stderr(Vercel 로그)로 보낸다.
    lg = logging.getLogger("askback24.ai")
    lg.setLevel(logging.INFO)
    lg.propagate = False
    if not lg.handlers:
        lg.addHandler(logging.StreamHandler())


def create_app(env: Mapping[str, str] | None = None, llm: Llm | None = None) -> FastAPI:
    _setup_logging()
    env = os.environ if env is None else env
    llm = llm or llm_from_env(env)
    labels = load_card_labels(Path(__file__).resolve().parents[2])
    first_agent = FirstAgent(llm, labels)  # 그래프는 앱이 뜰 때 한 번만 compile
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _error(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _invalid(_: Request, __: RequestValidationError) -> JSONResponse:
        # pydantic 오류 상세에는 입력값이 들어 있어 쓰지 않는다.
        return _error(400, "invalid_request", "invalid request")

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "http_error")
        return _error(exc.status_code, code, code.replace("_", " "))

    @app.exception_handler(Exception)
    async def _internal(_: Request, __: Exception) -> JSONResponse:
        return _error(500, "internal", "internal error")

    router = APIRouter(prefix=PREFIX, dependencies=[Depends(_make_auth(env))])

    @router.get("/health")
    def health() -> dict:
        # labels 는 data/ 가 함수에 묶였는지 배포에서 볼 수 있게 한다.
        return {"ok": True, "service": "askback24-ai", "labels": len(labels)}

    @router.post("/first-questions")
    async def first_questions(body: FirstRequest) -> FirstResponse:
        try:
            return await first_agent.run(body)
        except LlmError:
            # 로그 한 줄은 LoopAgent 가 남겼다.
            raise ApiError(503, "unavailable", "model is not ready") from None

    @router.post("/warmup")
    async def warmup() -> dict:
        # 첫 호출이 느린(약 17초) 모델을 미리 깨운다. 결과와 상관없이 200.
        try:
            await asyncio.wait_for(
                llm.complete_json("fast", "JSON 한 개만 답한다.", '{"ok":true} 를 그대로 돌려줘', timeout_s=WARMUP_S), WARMUP_S
            )
        except Exception:
            return {"ok": False}
        return {"ok": True}

    app.include_router(router)
    return app
