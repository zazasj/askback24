import json
from pathlib import Path

from api._agent.llm import FakeLlm
from evals.metrics_cards import coverage, duty_lines, off_domain, stability

ROOT = Path(__file__).resolve().parents[2]


def _draft(subs, used):
    return {"candidates": [
        {"ablt_unit": f"U{i}", "unit": f"단위{i}", "subcategory": s, "used_in": u}
        for i, (s, u) in enumerate(zip(subs, used))
    ]}


def test_off_domain():
    d = _draft(["20010202", "15090201", "08030204"], ["BA01", None, "BA02"])
    r = off_domain(d, ["20010202"])
    assert r["candidates"] == 3
    assert r["off_domain"] == 2
    assert r["off_domain_used"] == 1
    assert r["off_domain_used_units"] == ["단위2"]
    assert r["off_domain_rate"] == 2 / 3


def test_off_domain_by_unit_prefix():
    d = {"candidates": [
        {"ablt_unit": "2001020211", "unit": "a", "subcategory": "응용SW엔지니어링", "used_in": "BA01"},
        {"ablt_unit": "1509020101", "unit": "b", "subcategory": "항공기기체제작", "used_in": "BA01"},
    ]}
    r = off_domain(d, ["20010202"])
    assert r["off_domain"] == 1 and r["off_domain_used_units"] == ["b"]


def test_off_domain_empty():
    assert off_domain({"candidates": []}, ["x"])["off_domain_rate"] == 0.0


def _cards(*groups):
    return {"cards": [{"ncs": [{"ablt_unit": u} for u in g]} for g in groups]}


def test_stability():
    a = _cards(["A", "B", "C"], ["D"])
    assert stability(a, a) == 1.0
    assert stability(a, _cards(["A", "D"], ["B", "E"])) == 0.0
    assert stability(_cards(["A"]), _cards(["B"])) == 1.0  # 둘 다 쌍이 없음
    assert stability(_cards(["A", "B"]), _cards(["A", "B", "C"])) == 1 / 3


def test_duty_lines_mock():
    posts = json.loads((ROOT / "data" / "postings.json").read_text(encoding="utf-8"))
    p = next(x for x in posts if x["wantedAuthNo"] == "K-MOCK-0001")
    lines = duty_lines(p["jobCont"])
    assert len(lines) == 3
    assert lines[0] == "Java·Spring 기반 업무 시스템의 서버 개발 및 기타 업무 지원"


def test_duty_lines_edges():
    assert duty_lines("[회사소개]\n- 가") == []
    assert duty_lines("[담당업무]\n설명 줄\n· 가\n• 나\n[자격요건]\n- 다") == ["가", "나"]
    assert duty_lines("[담당업무]\n-  마지막 줄") == ["마지막 줄"]


async def test_coverage():
    posts = {
        "E1": {"jobCont": "[담당업무]\n- a\n- b\n[자격요건]\n- c"},
        "E2": {"jobCont": "[담당업무]\n- d\n- e"},
        "E3": {"jobCont": "[회사소개]\n- f"},
        "E4": {"jobCont": "[담당업무]\n- g"},
    }
    llm = FakeLlm([{"uncovered": [1]}, {"uncovered": [0, 1]}, {"x": 1}])
    r = await coverage(llm, posts, [{"label": "l", "plain": "p"}])
    assert r["postings_with_duties"] == 3
    assert r["lines"] == 4  # 판정 실패(E4)의 줄은 분모에서 뺀다
    assert r["uncovered"] == 3
    assert r["covered_rate"] == 0.25
    assert r["failed"] == 1
    assert r["uncovered_examples"] == [["E1", "b"], ["E2", "d"], ["E2", "e"]]


async def test_coverage_examples_capped_and_none():
    posts = {"E1": {"jobCont": "[담당업무]\n" + "\n".join(f"- 줄{i}" for i in range(30))}}
    r = await coverage(FakeLlm([{"uncovered": list(range(30))}]), posts, [])
    assert len(r["uncovered_examples"]) == 20
    r = await coverage(FakeLlm([]), {"E3": {"jobCont": "x"}}, [])
    assert r["lines"] == 0 and r["covered_rate"] is None


def test_main_writes_metrics_without_postings(tmp_path, capsys):
    from datetime import datetime

    from evals.metrics_cards import main

    d = tmp_path / "d.json"
    d.write_text(json.dumps({**_draft(["A", "B"], ["BA01", None]), "cards": []}), encoding="utf-8")
    assert main(["--draft", str(d), "--ncs", "A"], root=tmp_path, now=datetime(2026, 11, 1, 9, 0)) == 0
    out = capsys.readouterr().out
    assert "1/2" in out and "건너뜀" in out
    m = json.loads(next((tmp_path / "review" / "evals").glob("*-cards/cards.metrics.json")).read_text(encoding="utf-8"))
    assert m["off_domain"]["off_domain"] == 1 and "coverage" not in m and "stability" not in m
