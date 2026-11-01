from types import SimpleNamespace

from langgraph.graph import StateGraph

from _agent.graphs.rewrite_loop import LoopAgent, LoopSpec
from _agent.llm import FakeLlm, LlmError


def make_spec(key_field="key", name="final") -> LoopSpec:
    return LoopSpec(
        name=name,
        role="accurate",
        budget_s=10.0,
        system="시스템",
        key_field=key_field,
        key_of=lambda item: item,
        check=lambda req, item, text: ["too_short"] if len(text) < 5 else [],
        user_message=lambda req, only, issues: f"only={only} issues={issues}",
    )


def req(*keys):
    return SimpleNamespace(items=list(keys))


def rows(key_field, pairs):
    return {"questions": [{key_field: k, "text": t} for k, t in pairs]}


async def test_compiles_once(monkeypatch):
    calls = []
    orig = StateGraph.compile

    def counting(self, *a, **kw):
        calls.append(1)
        return orig(self, *a, **kw)

    monkeypatch.setattr(StateGraph, "compile", counting)
    llm = FakeLlm([rows("key", [("offer:sal", "충분히 긴 문장")]), rows("key", [("offer:sal", "충분히 긴 문장")])])
    agent = LoopAgent(make_spec(), llm)
    await agent.run(req("offer:sal"))
    await agent.run(req("offer:sal"))
    assert len(calls) == 1


async def test_key_field_final():
    llm = FakeLlm([rows("key", [("offer:sal", "  충분히   긴\n문장 "), ("offer:sal", "두번째는 버림 문장"), ("zzz", "모르는 키 문장입니다")])])
    passed, issues, rewrites, model = await LoopAgent(make_spec(), llm).run(req("offer:sal"))
    assert passed == {"offer:sal": "충분히 긴 문장"}
    assert issues == {} and rewrites == 0 and model == "fake"
    assert llm.calls[0]["role"] == "accurate"


async def test_rewrite_once_then_finish():
    llm = FakeLlm([rows("key", [("a", "짧"), ("b", "충분히 긴 문장")]), rows("key", [("a", "고친 긴 문장")])])
    passed, issues, rewrites, _ = await LoopAgent(make_spec(), llm).run(req("a", "b"))
    assert passed == {"a": "고친 긴 문장", "b": "충분히 긴 문장"} and issues == {} and rewrites == 1
    assert "only=['a']" in llm.calls[1]["user"]


async def test_first_write_error_propagates_and_logs_once(ai_log):
    try:
        await LoopAgent(make_spec(name="judge"), FakeLlm([LlmError("timeout")])).run(req("a"))
        raise AssertionError("no raise")
    except LlmError:
        pass
    lines = [r.getMessage() for r in ai_log.records if "unavailable" in r.getMessage()]
    assert len(lines) == 1 and lines[0].startswith("[ai] judge unavailable code=timeout ms=")


async def test_logs_name_and_key_label(ai_log):
    llm = FakeLlm([rows("key", [("offer:sal", "충분히 긴 문장")])])
    await LoopAgent(make_spec(), llm).run(req("offer:sal"))
    line = [r.getMessage() for r in ai_log.records][-1]
    assert line.startswith("[ai] final n=1 passed=1 retried=0 key=offer:sal issues=- ms=")
