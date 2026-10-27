import asyncio
import hmac
import os
from collections.abc import Mapping

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from pathlib import Path

from .checks import load_card_labels
from .errors import ApiError
from .graphs.first import run_first
from .llm import Llm, LlmError, llm_from_env
from .schemas import FirstRequest, FirstResponse

PREFIX = "/api/ai/v1"
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


def create_app(env: Mapping[str, str] | None = None, llm: Llm | None = None) -> FastAPI:
    env = os.environ if env is None else env
    llm = llm or llm_from_env(env)
    labels = load_card_labels(Path(__file__).resolve().parents[2])
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
        return {"ok": True, "service": "askback24-ai"}

    @router.post("/first-questions")
    async def first_questions(body: FirstRequest) -> FirstResponse:
        try:
            return await run_first(body, llm, labels)
        except LlmError:
            raise ApiError(503, "unavailable", "model is not ready") from None

    @router.post("/warmup")
    async def warmup() -> dict:
        # 첫 호출이 느린(약 17초) 모델을 미리 깨운다. 결과와 상관없이 200.
        try:
            await asyncio.wait_for(
                llm.complete_json("fast", "JSON 한 개만 답한다.", '{"ok":true} 를 그대로 돌려줘', timeout_s=20.0), 20.0
            )
        except Exception:
            return {"ok": False}
        return {"ok": True}

    app.include_router(router)
    return app
