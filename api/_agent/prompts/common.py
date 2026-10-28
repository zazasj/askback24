"""프롬프트 공통: 자료 안의 태그 이스케이프와 덤프."""
import json
import re

_TAG = re.compile(r"<(?=/?(?:공고|구직자 메모|들은 답)>)")


def _esc(s: str) -> str:
    # 자료 안의 태그 열기·닫기만 막고, 그 밖의 꺾쇠("서류전형 > 1차")는 원문 그대로 둔다.
    return _TAG.sub("‹", s)


def _dump(v: object) -> str:
    return _esc(json.dumps(v, ensure_ascii=False, indent=1))
