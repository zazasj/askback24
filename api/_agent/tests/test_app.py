from fastapi.testclient import TestClient

from _agent.app import create_app

ERR_UNAUTH = {"error": {"code": "unauthorized", "message": "invalid api key"}}


def test_health_requires_bearer():
    c = TestClient(create_app({"AI_API_KEY": "k"}))
    r = c.get("/api/ai/v1/health")
    assert r.status_code == 401
    assert r.json() == ERR_UNAUTH


def test_health_wrong_key_is_401():
    c = TestClient(create_app({"AI_API_KEY": "k"}))
    r = c.get("/api/ai/v1/health", headers={"Authorization": "Bearer x"})
    assert r.status_code == 401
    assert r.json() == ERR_UNAUTH


def test_health_ok_with_key():
    c = TestClient(create_app({"AI_API_KEY": "k"}))
    r = c.get("/api/ai/v1/health", headers={"Authorization": "Bearer k"})
    assert r.status_code == 200 and r.json() == {"ok": True, "service": "askback24-ai"}


def test_no_key_allowed_only_locally():
    assert TestClient(create_app({})).get("/api/ai/v1/health").status_code == 200
    assert TestClient(create_app({"VERCEL_ENV": "preview"})).get("/api/ai/v1/health").status_code == 401
    assert TestClient(create_app({"VERCEL_ENV": "production"})).get("/api/ai/v1/health").status_code == 401


def test_unknown_route_is_404_json():
    r = TestClient(create_app({})).get("/api/ai/v1/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    assert "detail" not in r.json()


def test_validation_error_is_400_without_request_content():
    from fastapi import APIRouter
    from pydantic import BaseModel

    class Body(BaseModel):
        n: int

    app = create_app({})
    router = APIRouter()

    @router.post("/echo")
    def echo(body: Body):
        return {"n": body.n}

    app.include_router(router, prefix="/api/ai/v1")
    r = TestClient(app).post("/api/ai/v1/echo", json={"n": "SECRET-경험-문장"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_request"
    assert "SECRET" not in r.text and "detail" not in r.json()


def test_unhandled_error_is_500_internal_without_content():
    from fastapi import APIRouter

    app = create_app({})
    router = APIRouter()

    @router.get("/boom")
    def boom():
        raise RuntimeError("SECRET-경험-문장")

    app.include_router(router, prefix="/api/ai/v1")
    r = TestClient(app, raise_server_exceptions=False).get("/api/ai/v1/boom")
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "internal", "message": "internal error"}}
    assert "SECRET" not in r.text


def test_warmup_calls_fast_once_and_returns_ok():
    from _agent.llm import FakeLlm

    llm = FakeLlm([{"ok": True}])
    r = TestClient(create_app({}, llm=llm)).post("/api/ai/v1/warmup")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert len(llm.calls) == 1 and llm.calls[0]["role"] == "fast" and llm.calls[0]["timeout_s"] == 20.0


def test_warmup_failure_is_still_200_ok_false():
    from _agent.llm import FakeLlm, LlmError

    r = TestClient(create_app({}, llm=FakeLlm([LlmError("timeout")]))).post("/api/ai/v1/warmup")
    assert r.status_code == 200 and r.json() == {"ok": False}


def test_warmup_requires_bearer():
    from _agent.llm import FakeLlm

    r = TestClient(create_app({"AI_API_KEY": "k"}, llm=FakeLlm([{"ok": True}]))).post("/api/ai/v1/warmup")
    assert r.status_code == 401
