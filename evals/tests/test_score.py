import json
from datetime import datetime

from api._agent.llm import LlmError, LlmResult
from evals import score
from evals.judges import SYSTEMS
from evals.runlog import append_jsonl, write_metrics


class RouterLlm:
    def __init__(self):
        self.calls = []

    async def complete_json(self, role, system, user, timeout_s):
        self.calls.append((role, system))
        if getattr(self, "judges_fail", False) and role != "fast":
            raise LlmError("timeout")
        if getattr(self, "fast_fail", False) and role == "fast":
            raise LlmError("timeout")
        if role == "fast":
            return LlmResult(data={"questions": [{"card_id": "BE01", "text": "신규 개발은 어떻게 맡나요? 궁금합니다"}]}, model="f")
        key = next(k for k, v in SYSTEMS.items() if v == system)
        data = {
            "guess_posting": {"choice": 1}, "guess_persona": {"choice": 1},
            "presupposes": {"presupposes": False}, "inflates": {"inflated": False, "facts": []},
        }[key]
        return LlmResult(data=data, model="j")


def _setup(tmp_path, with_judgements=True):
    root = tmp_path / "repo"
    (root / "data").mkdir(parents=True)
    (root / "data" / "cards.backend.json").write_text(
        json.dumps({"cards": [{"id": "BE01", "label": "신규 API 개발"}]}, ensure_ascii=False), encoding="utf-8")
    (root / "evals" / "personas").mkdir(parents=True)
    for n in "AB":
        (root / "evals" / "personas" / f"{n}.json").write_text(json.dumps({"skills": ["Java"]}), encoding="utf-8")
    pd = root / "evals" / "data" / "postings"
    pd.mkdir(parents=True)
    for n in ("P1", "P2", "P3"):
        (pd / f"{n}.json").write_text(json.dumps(
            {"wantedAuthNo": n, "corpNm": "(주)X", "wantedTitle": "t", "jobCont": "Java 서버"}, ensure_ascii=False), encoding="utf-8")
    run = root / "review" / "evals" / "r1"
    (run / "analysis").mkdir(parents=True)
    (run / "analysis" / "P1.json").write_text(json.dumps({"cards": [{"card_id": "BE01", "state": "explicit"}]}), encoding="utf-8")
    item = {"rank": 1, "card_id": "BE01", "card_label": "신규 API 개발", "pref": "want", "state": "explicit",
            "type": "opportunity", "template": "t", "template_text": "tt", "has_exp": False}
    for p in "AB":
        append_jsonl(run / "questions.jsonl", {
            "wantedAuthNo": "P1", "persona": p,
            "first": {"mode": "first", "questions": [
                {"rank": 1, "card_id": "BE01", "text": "신규 개발은 어떻게 맡나요? 궁금합니다", "source": "ai"}]},
            "first_input": {"mode": "first", "posting": {"jobCont": "Java 서버"}, "experience": "", "items": [item]},
            "final": {"mode": "final", "final_questions": [
                {"rank": 1, "card_id": "BE01", "text": "최종 질문은 이렇습니다 알려주세요", "source": "template"}]},
            "final_input": None, "first_ms": 1000, "final_ms": 2000,
        })
    if with_judgements:
        append_jsonl(run / "judgements.jsonl", {"wantedAuthNo": "P1", "card_id": "BE01", "expected": "confirmed", "got": "confirmed"})
    return root, run


def test_main_writes_outputs(tmp_path, capsys):
    root, run = _setup(tmp_path)
    llm = RouterLlm()
    assert score.main(["--run", str(run)], root=root, llm=llm) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert m["first"]["template_rate"] == 0.0 and m["final"]["template_rate"] == 1.0
    assert m["first"]["latency_p95_s"] == 1.0 and m["final"]["latency_p95_s"] == 2.0
    assert m["first"]["similarity_ab"] == 1.0
    assert set(m["judge"]) == {"posting_guess", "persona_guess", "presupposition", "inflation"}
    # 보기 순서가 섞여 맞고 틀림은 고정되지 않으니 건수만 본다
    assert m["judge"]["persona_guess"]["n"] == 2 and m["judge"]["persona_guess"]["failed"] == 0
    assert m["judgements"]["accuracy"] == 1.0
    assert m["raw"]["rate"] == 0.0
    judged = [json.loads(line) for line in (run / "judge.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(judged) == 4
    summary = (run / "summary.md").read_text(encoding="utf-8")
    assert "questions.metrics.json" in summary and "판정 실패" in summary
    out = capsys.readouterr().out
    assert "신규 개발" not in out and "Java" not in out


def test_skip_raw_and_limit(tmp_path):
    root, run = _setup(tmp_path)
    llm = RouterLlm()
    assert score.main(["--run", str(run), "--skip-raw", "--limit", "1"], root=root, llm=llm) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert "raw" not in m
    assert not any(role == "fast" for role, _ in llm.calls)
    assert len((run / "judge.jsonl").read_text(encoding="utf-8").splitlines()) == 2


def test_missing_judgements_skips(tmp_path, capsys):
    root, run = _setup(tmp_path, with_judgements=False)
    assert score.main(["--run", str(run), "--skip-raw"], root=root, llm=RouterLlm()) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert "judgements" not in m
    assert "judgements.jsonl" in capsys.readouterr().out


def test_missing_questions_is_friendly(tmp_path, capsys):
    root, run = _setup(tmp_path)
    (run / "questions.jsonl").unlink()
    assert score.main(["--run", str(run)], root=root, llm=RouterLlm()) == 1
    assert "questions.jsonl" in capsys.readouterr().out


def test_rerun_does_not_duplicate_judge_rows(tmp_path):
    root, run = _setup(tmp_path)
    for _ in range(2):
        score.main(["--run", str(run), "--skip-raw"], root=root, llm=RouterLlm())
    assert len((run / "judge.jsonl").read_text(encoding="utf-8").splitlines()) == 4


def test_summary_tables_all_metrics_files(tmp_path):
    run = tmp_path / "run"
    run.mkdir()
    (run / "meta.json").write_text(json.dumps({"label": "x", "commit": "abc"}), encoding="utf-8")
    write_metrics(run, "analysis", {"fabricated": 2, "nested": {"a": 1}, "failed": 3})
    write_metrics(run, "questions", {"judge": {"inflation": {"rate": 0.5, "n": 2, "failed": 4}}})
    score.write_summary(run)
    s = (run / "summary.md").read_text(encoding="utf-8")
    assert "analysis.metrics.json" in s and "fabricated" in s and "nested.a" in s
    assert "판정 실패 4" in s


def test_scored_with_and_unknown_terms_split(tmp_path):
    root, run = _setup(tmp_path)
    assert score.main(["--run", str(run), "--skip-raw"], root=root, llm=RouterLlm()) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert set(m["scored_with"]) == {"commit", "prompt_hashes"} and "first" in m["scored_with"]["prompt_hashes"]
    assert set(m["unknown_terms"]) == {"first", "final"}


def test_skip_judges_keeps_other_metrics(tmp_path, capsys):
    root, run = _setup(tmp_path)
    llm = RouterLlm()
    assert score.main(["--run", str(run), "--skip-judges"], root=root, llm=llm) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert "judge" not in m and m["raw"]["n"] == 2 and "template_rate" in m["first"] and "unknown_terms" in m
    assert all(role == "fast" for role, _ in llm.calls)
    assert not (run / "judge.jsonl").exists()
    assert "--skip-judges" in capsys.readouterr().out


def test_skip_judges_and_raw_needs_no_llm(tmp_path):
    root, run = _setup(tmp_path)
    # 키가 없어도(빈 env) LLM 을 만들지 않으므로 끝난다
    assert score.main(["--run", str(run), "--skip-judges", "--skip-raw"], root=root, env={}) == 0


def test_all_judges_failed_exits_1(tmp_path, capsys):
    root, run = _setup(tmp_path)
    llm = RouterLlm()
    llm.judges_fail = True
    assert score.main(["--run", str(run), "--skip-raw"], root=root, llm=llm) == 1
    assert "모두 실패" in capsys.readouterr().out
    assert not (run / "questions.metrics.json").exists()
    # 판정 줄은 그때까지 덧붙인 대로 남는다
    assert len((run / "judge.jsonl").read_text(encoding="utf-8").splitlines()) == 4


def test_raw_all_failed_prints_dash(tmp_path, capsys):
    root, run = _setup(tmp_path)
    llm = RouterLlm()
    llm.fast_fail = True
    assert score.main(["--run", str(run), "--skip-judges"], root=root, llm=llm) == 0
    m = json.loads((run / "questions.metrics.json").read_text(encoding="utf-8"))
    assert m["raw"]["rate"] is None and m["raw"]["failed"] == 2
    assert "날것 위반율 -" in capsys.readouterr().out
