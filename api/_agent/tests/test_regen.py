import hashlib
import json
import shutil
from pathlib import Path

from _agent import regen
from _agent.schemas import AnalysisBody, AnalysisCard, AnalysisMeta, AnalysisResponse, OfferBlank, Signal
from _agent.tests.test_analysis import REAL_ENV, ScriptLlm, card, nps_client, ok_signal, run_of

ROOT = Path(__file__).resolve().parents[3]
NPS_NAME = "국민연금 사업장 가입자 현황"


def fresh(cards=None, blanks=None, signals=None) -> AnalysisResponse:
    return AnalysisResponse(
        analysis=AnalysisBody(wantedAuthNo="K-MOCK-0007", cards=cards or [], blanks=blanks or []),
        signals=signals or [], out_of_dictionary=[],
        meta=AnalysisMeta(graph_version="analysis-1", model="fake", created_at="2026-10-28T00:00:00+00:00"),
    )


def sig(kind, text="문장", source="모의", source_name="고용24 공고 이력") -> Signal:
    return Signal(kind=kind, text=text, source=source, source_name=source_name)


def test_merge_keeps_questions_override():
    current = {"wantedAuthNo": "K-MOCK-0007", "cards": [
        {"card_id": "BE15", "state": "vague", "reason": "예전", "questions": {"conflict": "사람이 쓴 질문"}}], "blanks": []}
    out = regen.merge_candidate(current, fresh(cards=[AnalysisCard(card_id="BE15", state="vague", reason="새 이유")]))
    assert out["cards"] == [{"card_id": "BE15", "state": "vague", "reason": "새 이유", "questions": {"conflict": "사람이 쓴 질문"}}]
    assert out["meta"] == {"graph_version": "analysis-1", "model": "fake", "created_at": "2026-10-28T00:00:00+00:00"}


def test_merge_keeps_human_blank_text_same_status():
    old = {"topic": "sal", "status": "check", "label": "사람 라벨", "basis": "사람 근거", "question": "사람 질문", "evidence": {"field": "sal", "quote": "옛 값"}}
    current = {"wantedAuthNo": "x", "cards": [], "blanks": [old]}
    same = OfferBlank(topic="sal", status="check", label="새", basis="새", question="새", evidence={"field": "sal", "quote": "새 값"})
    other = OfferBlank(topic="workHours", status="missing", label="새 라벨", basis="b", question="q")
    out = regen.merge_candidate(current, fresh(blanks=[same, other]))
    assert out["blanks"][0] == old
    assert out["blanks"][1]["label"] == "새 라벨" and "evidence" not in out["blanks"][1]
    changed = OfferBlank(topic="sal", status="vague", label="새", basis="새", question="새")
    assert regen.merge_candidate(current, fresh(blanks=[changed]))["blanks"][0]["label"] == "새"


def test_merge_drops_absent_and_needs_review():
    cards = [AnalysisCard(card_id="BE01", state="absent", reason="없음"),
             AnalysisCard(card_id="BE02", state="explicit", reason="이유", evidence={"field": "jobCont", "quote": "q"}, needs_review=True)]
    out = regen.merge_candidate({"wantedAuthNo": "x", "cards": [], "blanks": []}, fresh(cards=cards))
    assert out["cards"] == [{"card_id": "BE02", "state": "explicit", "evidence": {"field": "jobCont", "quote": "q"}, "reason": "이유"}]


def test_merge_keeps_legacy_signal_lines():
    legacy_a = {"text": "임금체불 명단공개 대상에는 올라 있지 않아요", "source": "모의", "source_name": "임금체불 사업주 명단"}
    legacy_b = {"text": "업종에서 유추", "source": "모의", "source_name": "업종 정보에서 유추"}
    old_nps = {"text": "옛 연금", "source": "실제", "source_name": NPS_NAME}
    old_wage = {"text": "체불 명단에 올라 있어요", "source": "모의", "source_name": "임금체불 사업주 명단"}
    out = regen.merge_signals([legacy_a, old_nps, legacy_b, old_wage], [sig("pension_flow", "새 연금", "모의", NPS_NAME)])
    assert out == [{"text": "새 연금", "source": "모의", "source_name": NPS_NAME}, legacy_a, legacy_b]


def test_report_lists_state_changes():
    cur = {"wantedAuthNo": "K-MOCK-0007", "cards": [
        {"card_id": "BE01", "state": "explicit", "evidence": {"field": "jobCont", "quote": "옛"}, "reason": "r"},
        {"card_id": "BE03", "state": "vague", "reason": "r"}],
        "blanks": [{"topic": "sal", "status": "check", "label": "l", "basis": "b", "question": "q"}]}
    new = fresh(cards=[
        AnalysisCard(card_id="BE01", state="inferred", evidence={"field": "jobCont", "quote": "새"}, reason="r"),
        AnalysisCard(card_id="BE02", state="explicit", reason="r", needs_review=True)],
        blanks=[OfferBlank(topic="sal", status="vague", label="l", basis="b", question="q")],
        signals=[sig("pension_flow", source="모의", source_name=NPS_NAME)])
    cur_sig = [{"text": "t", "source": "실제", "source_name": NPS_NAME}]
    text = regen.report_section("K-MOCK-0007", cur, cur_sig, new, regen.merge_signals(cur_sig, new.signals))
    for want in ("BE01: explicit → inferred", "근거", "needs_review", "BE02", "사라진 카드", "BE03", "새 카드",
                 "sal: check → vague", "배지 실제 → 모의", "pension_flow"):
        assert want in text, want
    assert "적용 전 `npm run check`" in regen.report_header()


def _copy_root(tmp_path) -> Path:
    shutil.copytree(ROOT / "data", tmp_path / "data")
    return tmp_path


def _digest(root: Path) -> dict:
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root / "data").rglob("*")) if p.is_file()}


def _llm():
    good = run_of(BE01=card("BE01", "explicit", "jobCont", "서버 개발"))
    return ScriptLlm(a=good, b=good, signal=ok_signal())


def test_default_does_not_touch_data(tmp_path):
    root = _copy_root(tmp_path)
    before = _digest(root)
    assert regen.main(["--only", "K-MOCK-0001"], root=root, env={}, llm=_llm()) == 0
    assert _digest(root) == before
    out = root / "review" / "analysis-regen"
    cand = json.loads((out / "analysis" / "K-MOCK-0001.json").read_text(encoding="utf-8"))
    assert cand["meta"]["graph_version"] == "analysis-1" and all(c["state"] != "absent" for c in cand["cards"])
    assert "K-MOCK-0001" in json.loads((out / "signals.json").read_text(encoding="utf-8"))
    assert (out / "report.md").is_file()


def test_apply_writes_data(tmp_path):
    root = _copy_root(tmp_path)
    assert regen.main(["--only", "K-MOCK-0001", "--apply"], root=root, env={}, llm=_llm()) == 0
    assert "meta" in json.loads((root / "data/analysis/K-MOCK-0001.json").read_text(encoding="utf-8"))
    assert "K-MOCK-0002" in json.loads((root / "data/signals.json").read_text(encoding="utf-8"))


def test_outputs_have_no_real_identity(tmp_path):
    root = _copy_root(tmp_path)
    assert regen.main(["--only", "K-MOCK-0001"], root=root, env=REAL_ENV, llm=_llm(), http=nps_client()) == 0
    for p in (root / "review" / "analysis-regen").rglob("*"):
        if p.is_file():
            t = p.read_text(encoding="utf-8")
            for secret in ("테스트실제", "0000000000", "000-00-00000", "FAKE-KEY"):
                assert secret not in t
