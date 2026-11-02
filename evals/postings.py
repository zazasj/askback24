"""평가용 공고 읽기. 실제 공고는 evals/data/postings/ 에만 둔다(git 밖)."""
import json
from pathlib import Path

REQUIRED = ("wantedAuthNo", "corpNm", "wantedTitle", "jobCont")
# shared/contract.ts Posting 의 문자열 칸. 빠지면 ""로 채운다
STRING_FIELDS = (
    "wantedAuthNo", "corpNm", "indTpNm", "totPsncnt", "busiSize", "busiCont", "wantedTitle",
    "jobsNm", "jobsCd", "jobCont", "empTpNm", "collectPsncnt", "salTpNm", "sal", "enterTpNm",
    "eduNm", "pfCond", "etcPfCond", "selMthd", "workRegion", "regionCd", "workdayWorkhrCont",
    "fourIns", "retirepay", "etcWelfare", "receiptCloseDt",
)


class PostingError(Exception):
    def __init__(self, file: str, reason: str):
        super().__init__(f"{file}: {reason}")
        self.file = file
        self.reason = reason


def load_postings(dir: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in sorted(dir.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8-sig"))
        except ValueError:
            raise PostingError(path.name, "JSON이 아닙니다") from None
        if not isinstance(raw, dict):
            raise PostingError(path.name, "공고 하나(JSON 객체)여야 합니다")
        missing = [k for k in REQUIRED if not str(raw.get(k) or "").strip()]
        if missing:
            raise PostingError(path.name, f"필수 칸이 없거나 비었습니다: {', '.join(missing)}")
        posting = {k: "" for k in STRING_FIELDS}
        posting["draft"] = False
        posting.update({k: v for k, v in raw.items() if v is not None})
        no = str(posting["wantedAuthNo"])
        if no in out:
            raise PostingError(path.name, f"wantedAuthNo가 겹칩니다: {no}")
        out[no] = posting
    return out
