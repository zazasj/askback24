from evals.gold import Gold, GoldCard
from evals.metrics_analysis import analysis_metrics

TEXT = "서버 API를  개발합니다"
POSTINGS = {"E1": {"jobCont": TEXT, "pfCond": "경력 무관"}}


def _gold(overlap=None, blanks=None):
    return Gold(
        cards={
            ("E1", "C1"): GoldCard("explicit", "jobCont"),
            ("E1", "C2"): GoldCard("absent", None),
            ("E1", "C3"): GoldCard("vague", "pfCond"),
        },
        blanks=blanks or {},
        overlap=overlap or {},
        judgements=[],
    )


def _out(cards, blanks=()):
    return {"wantedAuthNo": "E1", "meta": {}, "cards": list(cards), "blanks": list(blanks)}


def _card(cid, state, field=None, quote=None):
    c = {"card_id": cid, "state": state, "reason": "r"}
    if field:
        c["evidence"] = {"field": field, "quote": quote}
    return c


def _m(**kw):
    outs = {"E1": _out([
        _card("C1", "explicit", "jobCont", "서버 API를 개발합니다"),  # 공백 두 칸이어도 한 칸으로 비교
        _card("C2", "explicit", "jobCont", "원문에 없는 문장"),
    ])}  # C3는 결과 파일에 없음 → absent
    return analysis_metrics(_gold(**kw), outs, POSTINGS, [1.0, 2.0])


def test_counts_and_rates():
    m = _m()
    assert m["fabricated"] == 1 and m["missed"] == 0
    assert m["confusion"]["absent"]["explicit"] == 1
    assert m["confusion"]["vague"]["absent"] == 1
    assert m["accuracy_non_absent"] == 1 / 3
    assert m["quote_exists"] == 0.5
    assert m["field_match"] == 1.0
    assert m["failed"] == 0
    assert m["per_state"]["explicit"] == {"precision": 0.5, "recall": 1.0}
    assert m["per_state"]["absent"] == {"precision": 0.0, "recall": 0.0}


def test_missed_counts_explicit_to_absent():
    outs = {"E1": _out([])}
    m = analysis_metrics(_gold(), outs, POSTINGS, [])
    assert m["missed"] == 1 and m["fabricated"] == 0
    assert m["latency_p95_s"] is None


def test_kappa_perfect():
    ov = {("E1", "C1"): {"A": "explicit", "B": "explicit"}, ("E1", "C2"): {"A": "vague", "B": "vague"},
          ("E1", "C3"): {"A": "absent", "B": "absent"}}
    m = _m(overlap=ov)
    assert m["human_kappa"] == 1.0
    assert m["human_agreement"] == 1.0  # 둘 다 absent인 칸은 뺀다


def test_agreement_excludes_both_absent_and_kappa_partial():
    ov = {("E1", "C1"): {"A": "explicit", "B": "vague"}, ("E1", "C2"): {"A": "absent", "B": "absent"},
          ("E1", "C3"): {"A": "vague", "B": "vague"}}
    m = _m(overlap=ov)
    assert m["human_agreement"] == 0.5
    assert 0 < m["human_kappa"] < 1


def test_no_overlap_is_none():
    m = _m()
    assert m["human_agreement"] is None and m["human_kappa"] is None


def test_blanks_default_present_and_failed():
    g = _gold(blanks={("E1", "sal"): "present", ("E1", "onsite"): "missing", ("E1", "probation"): "vague"})
    outs = {
        "E1": _out([], [{"topic": "onsite", "status": "missing"}, {"topic": "probation", "status": "check"}]),
        "E2": "LlmError",
    }
    m = analysis_metrics(g, outs, POSTINGS, [3.0])
    assert m["blanks_accuracy"] == 2 / 3  # sal은 결과에 없으니 present로 본다
    assert m["failed"] == 1


def test_latency_p95_nearest_rank():
    m = analysis_metrics(_gold(), {"E1": _out([])}, POSTINGS, [float(i) for i in range(1, 21)])
    assert m["latency_p95_s"] == 19.0
