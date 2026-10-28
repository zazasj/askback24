# 저장·화면에는 정확한 인원 대신 구간만 쓴다.
MEMBER_BANDS: list[tuple[int, int | None, str]] = [
    (1, 9, "1~9명"),
    (10, 29, "10~29명"),
    (30, 99, "30~99명"),
    (100, 299, "100~299명"),
    (300, None, "300명 이상"),
]


def member_band(n: int) -> str | None:
    if n <= 0:
        return None
    for lo, hi, label in MEMBER_BANDS:
        if n >= lo and (hi is None or n <= hi):
            return label
    return None
