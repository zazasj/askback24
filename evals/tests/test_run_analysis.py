import json
from datetime import datetime

from api._agent.schemas import AnalysisBody, AnalysisCard, AnalysisMeta, AnalysisRequest, AnalysisResponse, Evidence
from evals import gold
from evals.run_analysis import main, run_analysis
from evals.runlog import read_jsonl


def _res(no):
    card = AnalysisCard(card_id="BE01", state="explicit", reason="r", evidence=Evidence(field="jobCont", quote="개발"))
    absent = AnalysisCard(card_id="BE02", state="absent", reason="r")
    return AnalysisResponse(
        analysis=AnalysisBody(wantedAuthNo=no, cards=[card, absent], blanks=[]),
        signals=[], out_of_dictionary=[],
        meta=AnalysisMeta(graph_version="g", model="m-test", created_at="2026-11-01T00:00:00"),
    )


class FakeAgent:
    def __init__(self, boom_on=None):
        self.boom_on = boom_on
        self.seen: list[AnalysisRequest] = []

    async def run(self, req):
        self.seen.append(req)
        no = req.posting["wantedAuthNo"]
        if no == self.boom_on:
            raise RuntimeError("회사 정보가 섞인 글")
        return _res(no)


POSTINGS = {
    "E1": {"wantedAuthNo": "E1", "jobCont": "서버 개발"},
    "E2": {"wantedAuthNo": "E2", "jobCont": "앱 개발"},
}


async def test_run_analysis_continues(tmp_path):
    outs = await run_analysis(FakeAgent(boom_on="E1"), POSTINGS, tmp_path)
    assert outs["E1"] == "RuntimeError"  # 글은 담지 않고 종류만
    assert (tmp_path / "analysis" / "E2.json").exists()
    assert not (tmp_path / "analysis" / "E1.json").exists()
    data = json.loads((tmp_path / "analysis" / "E2.json").read_text(encoding="utf-8"))
    assert [c["card_id"] for c in data["cards"]] == ["BE01"]  # absent 카드는 파일에 없음
    assert outs["E2"] == data
    rows = read_jsonl(tmp_path / "analysis.timing.jsonl")
    assert [(r["wantedAuthNo"], r["ok"]) for r in rows] == [("E1", False), ("E2", True)]
    assert all(r["elapsed_s"] >= 0 for r in rows)


async def test_requests_use_backend_job(tmp_path):
    agent = FakeAgent()
    await run_analysis(agent, {"E1": POSTINGS["E1"]}, tmp_path)
    assert agent.seen[0].job == "backend"


def _setup(tmp_path, with_gold):
    data = tmp_path / "evals" / "data"
    (data / "postings").mkdir(parents=True)
    for no in ("E1", "E2"):
        p = {"wantedAuthNo": no, "corpNm": "(주)OO소프트", "wantedTitle": "t", "jobCont": f"서버 개발 {no}"}
        (data / "postings" / f"{no}.json").write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    if with_gold:
        g = gold.Gold(
            cards={(no, c): gold.GoldCard("explicit" if c == "BE01" else "absent", "jobCont" if c == "BE01" else None)
                   for no in ("E1", "E2") for c in ("BE01", "BE02")},
            blanks={}, overlap={}, judgements=[],
        )
        (data / "gold.json").write_text(json.dumps(gold._dump(g), ensure_ascii=False), encoding="utf-8")


def _last_line(capsys):
    return capsys.readouterr().out.strip().splitlines()[-1]


def test_main_without_gold_skips_metrics(tmp_path, capsys):
    _setup(tmp_path, with_gold=False)
    code = main(["--label", "t1"], root=tmp_path, agent=FakeAgent(), now=datetime(2026, 11, 1, 9, 0))
    out = capsys.readouterr().out
    assert code == 0
    assert "정답표가 없어 ① 지표는 건너뜀" in out
    run = tmp_path / out.strip().splitlines()[-1]
    assert (run / "analysis" / "E1.json").exists() and (run / "meta.json").exists()
    assert not (run / "analysis.metrics.json").exists()
    meta = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    assert meta["models"] == {"analysis": "m-test"} and meta["gold_hash"] is None
    assert "OO소프트" not in out and "서버 개발" not in out


def test_main_with_gold_writes_metrics_and_limit(tmp_path, capsys):
    _setup(tmp_path, with_gold=True)
    code = main(["--label", "t2", "--limit", "1"], root=tmp_path, agent=FakeAgent(), now=datetime(2026, 11, 1, 9, 0))
    run = tmp_path / _last_line(capsys)
    assert code == 0
    m = json.loads((run / "analysis.metrics.json").read_text(encoding="utf-8"))
    assert m["accuracy_non_absent"] == 1.0 and m["failed"] == 0
    assert sorted(p.name for p in (run / "analysis").iterdir()) == ["E1.json"]  # --limit 1
    meta = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    assert len(meta["gold_hash"]) == 12
