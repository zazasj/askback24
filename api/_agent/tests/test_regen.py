import hashlib
import json
import shutil
from pathlib import Path

from _agent import regen
from _agent.schemas import AnalysisBody, AnalysisCard, AnalysisMeta, AnalysisResponse, OfferBlank, Signal
from _agent.tests.test_analysis import REAL_ENV, ScriptLlm, card, nps_client, ok_signal, run_of

ROOT = Path(__file__).resolve().parents[3]
NPS_NAME = "국민연금 사업장 가입자 현황"
PENSION_TEXT = "최근 12개월 퇴사 인원이 입사 인원보다 많아요"
REPOST_TEXT = "같은 직무 공고가 6개월 안에 3번 등록됐어요"


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
    old_nps = {"text": PENSION_TEXT, "source": "실제", "source_name": NPS_NAME}
    old_wage = {"text": "체불 명단에 올라 있어요", "source": "모의", "source_name": "임금체불 사업주 명단"}
    out = regen.merge_signals([legacy_a, old_nps, legacy_b, old_wage], [sig("pension_flow", "새 연금", "모의", NPS_NAME)])
    assert out == [{"text": "새 연금", "source": "모의", "source_name": NPS_NAME, "kind": "pension_flow"}, legacy_a, legacy_b]


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
    cur_sig = [{"text": PENSION_TEXT, "source": "실제", "source_name": NPS_NAME}]
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


def report_of(cur_sig, new_signals, cards_cur=None, cards=None):
    cur = {"wantedAuthNo": "K-MOCK-0007", "cards": cards_cur or [], "blanks": []}
    new = fresh(signals=new_signals, cards=cards)
    return regen.report_section("K-MOCK-0007", cur, cur_sig, new, regen.merge_signals(cur_sig, new.signals))


def test_report_lists_dropped_lines_with_text_ask_source_and_real_flag():
    cur_sig = [{"text": PENSION_TEXT, "source": "실제", "source_name": NPS_NAME, "ask": "옛 질문이에요?"}]
    text = report_of(cur_sig, [])
    assert "빠짐: pension_flow" in text and PENSION_TEXT in text and "옛 질문이에요?" in text and "[실제]" in text
    assert "pension_flow: 실제 줄 빠짐" in text


def test_report_lists_changed_line_and_ask_change():
    cur_sig = [{"text": REPOST_TEXT, "source": "모의", "source_name": "고용24 공고 이력", "ask": "옛 질문이에요?"}]
    new = [Signal(kind="reposting", text=REPOST_TEXT, source="모의", source_name="고용24 공고 이력", ask="새 질문이에요?", ask_source="ai")]
    text = report_of(cur_sig, new)
    assert "바뀜: reposting" in text and "옛 질문이에요?" in text and "새 질문이에요?" in text
    assert "실제 줄" not in text


def test_report_flags_real_changed_to_mock():
    cur_sig = [{"text": PENSION_TEXT, "source": "실제", "source_name": NPS_NAME}]
    text = report_of(cur_sig, [sig("pension_flow", PENSION_TEXT, "모의", NPS_NAME)])
    assert "pension_flow: 배지 실제 → 모의" in text


def test_report_reason_changes_section():
    old = [{"card_id": "BE01", "state": "vague", "reason": "옛 이유", "evidence": None}]
    text = report_of([], [], cards_cur=old, cards=[AnalysisCard(card_id="BE01", state="vague", reason="새 이유")])
    assert "이유(reason) 바뀜" in text and "BE01: 옛 이유 → 새 이유" in text


def test_legacy_line_detected_by_meaning_not_source_name():
    legacy = {"text": "이 회사의 백엔드 공고는 이번이 처음이에요", "source": "모의", "source_name": "고용24 공고 이력", "ask": "처음 뽑는 이유는 무엇인가요?"}
    assert regen.current_kind(legacy) is None
    assert regen.current_kind({"text": REPOST_TEXT, "source": "모의", "source_name": "고용24 공고 이력"}) == "reposting"
    assert regen.current_kind({"text": "x", "source_name": "임의", "kind": "wage_arrears"}) == "wage_arrears"
    assert regen.merge_signals([legacy], []) == [legacy]
    text = report_of([legacy], [])
    assert "빠짐: reposting" not in text


def test_report_warns_on_zero_signals_and_missing_question_mark():
    assert "신호가 하나도 없어요" in report_of([], [])
    new = [Signal(kind="reposting", text=REPOST_TEXT, source="모의", source_name="고용24 공고 이력", ask="물음표가 없어요", ask_source="ai")]
    assert "?로 끝나지 않아요" in report_of([], new)


def test_small_giant_keeps_current_human_ask_and_keeps_kind_fields():
    cur = [{"text": "강소기업 명단에 '인재육성형중소기업'으로 올라 있어요", "source": "모의", "source_name": "고용24 강소기업 정보", "ask": "신입 교육은 어떻게 진행되나요?"}]
    new = [Signal(kind="small_giant", text="강소기업 명단에 '인재육성형중소기업'으로 2025년에 올라 있어요", source="모의", source_name="고용24 강소기업 정보")]
    out = regen.merge_signals(cur, new)
    assert out[0]["ask"] == "신입 교육은 어떻게 진행되나요?" and out[0]["kind"] == "small_giant"
    assert "ask_source" not in out[0]
    assert "경고" in report_of(cur, new) and "질문을 잃었어요" not in report_of(cur, new)
    ai = Signal(kind="reposting", text=REPOST_TEXT, source="모의", source_name="고용24 공고 이력", ask="질문이에요?", ask_source="ai")
    assert regen.merge_signals([], [ai])[0]["ask_source"] == "ai"


def test_run_all_survives_unexpected_exception():
    import asyncio

    class Boom:
        async def run(self, req):
            if req.posting["wantedAuthNo"] == "A":
                raise KeyError("(주)테스트실제 비밀")
            return fresh()

    out = asyncio.run(regen._run_all(Boom(), [{"wantedAuthNo": "A"}, {"wantedAuthNo": "B"}]))
    assert out["A"] == "KeyError" and isinstance(out["B"], AnalysisResponse)


def test_main_exit_1_and_report_has_only_exception_type(tmp_path, monkeypatch):
    root = _copy_root(tmp_path)

    async def boom(self, req):
        raise ValueError("(주)테스트실제 비밀")

    monkeypatch.setattr(regen.AnalysisAgent, "run", boom)
    assert regen.main(["--only", "K-MOCK-0001"], root=root, env={}, llm=_llm()) == 1
    t = (root / "review/analysis-regen/report.md").read_text(encoding="utf-8")
    assert "ValueError" in t and "테스트실제" not in t and "비밀" not in t
