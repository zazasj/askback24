import hashlib
import json
from pathlib import Path

from _agent import cards_draft
from _agent.llm import FakeLlm, LlmError
from _agent.tests.test_cards import drafts

ROOT = Path(__file__).resolve().parents[3]
ARGS = ["--job", "backend", "--job-label", "백엔드 개발자", "--ncs", "20010202"]


def _digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def test_writes_review_files_not_data(tmp_path):
    book = ROOT / "data" / "cards.backend.json"
    before = _digest(book)
    code = cards_draft.main([*ARGS, "--out", str(tmp_path)], root=ROOT, env={}, llm=FakeLlm([drafts(3)]))
    assert code == 0
    body = json.loads((tmp_path / "backend.json").read_text(encoding="utf-8"))
    assert [c["id"] for c in body["cards"]] == ["BA01", "BA02", "BA03"]
    assert (tmp_path / "backend.report.md").is_file()
    assert _digest(book) == before


def test_report_lists_sources_and_issues(tmp_path):
    bad = drafts(2)
    bad["cards"][1]["questions"]["depth"] = "이 공고에 적힌 일은 어디까지 맡게 되나요? 궁금합니다."
    llm = FakeLlm([bad, LlmError("timeout")])
    assert cards_draft.main([*ARGS, "--out", str(tmp_path)], root=ROOT, env={}, llm=llm) == 0
    md = (tmp_path / "backend.report.md").read_text(encoding="utf-8")
    assert "모의" in md and "실제 스냅숏" in md
    assert "후보 12개" in md and "수준 6 이상 0개" in md and "수준 모름 12개" in md
    assert "question_mentions_posting" in md and "BA02" in md
    assert "카드이름1" in md and "2001020211" in md
    assert "안 쓰인 후보" in md and "20010202-mock-08" in md


def test_compare_maps_backend_cards(tmp_path):
    args = [*ARGS, "--compare", "data/cards.backend.json", "--out", str(tmp_path)]
    assert cards_draft.main(args, root=ROOT, env={}, llm=FakeLlm([drafts(2)])) == 0
    md = (tmp_path / "backend.report.md").read_text(encoding="utf-8")
    section = md.split("## 기존 사전과 비교")[1]
    be01 = next(line for line in section.splitlines() if "BE01" in line)
    assert "신규 API 개발" in be01 and "BA01" in be01 and "카드이름1" in be01
    assert "BE02" in section and "애플리케이션 설계" in section


def test_failure_exit_code_and_no_files(tmp_path, capsys):
    code = cards_draft.main([*ARGS, "--out", str(tmp_path)], root=ROOT, env={}, llm=FakeLlm([LlmError("timeout")]))
    assert code == 1
    assert "timeout" in capsys.readouterr().out
    assert not (tmp_path / "backend.json").exists()


def test_cli_raises_llm_call_cap_with_deadline(tmp_path):
    llm = FakeLlm([drafts(1)])
    assert cards_draft.main([*ARGS, "--out", str(tmp_path)], root=ROOT, env={}, llm=llm) == 0
    assert llm.calls[0]["timeout_s"] > 45


def test_refuses_out_inside_data(capsys):
    for out in ("data/x", "data", "review/../data/y"):
        assert cards_draft.main([*ARGS, "--out", out], root=ROOT, env={}, llm=FakeLlm([drafts(1)])) == 1
        assert "data/" in capsys.readouterr().out
    assert not (ROOT / "data" / "x").exists()


def test_failure_prints_api_error_message(tmp_path, capsys):
    args = ["--job", "backend", "--job-label", "백엔드 개발자", "--ncs", "99999999", "--out", str(tmp_path)]
    assert cards_draft.main(args, root=ROOT, env={}, llm=FakeLlm([])) == 1
    assert "code=invalid_request, no units" in capsys.readouterr().out
    assert not (tmp_path / "backend.json").exists()


def test_compare_row_without_match(tmp_path):
    book = tmp_path / "book.json"
    book.write_text(
        json.dumps({"cards": [{"id": "X1", "label": "없는 일", "ncs": [{"unit": "존재하지않는단위"}]}]}), encoding="utf-8"
    )
    code = cards_draft.main([*ARGS, "--compare", str(book), "--out", str(tmp_path / "o")], root=ROOT, env={}, llm=FakeLlm([drafts(1)]))
    assert code == 0
    row = next(l for l in (tmp_path / "o" / "backend.report.md").read_text(encoding="utf-8").splitlines() if "X1" in l)
    assert "묶은 초안 카드 없음" in row and "후보에 없는 이름: 존재하지않는단위" in row
