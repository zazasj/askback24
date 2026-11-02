import math

# ②③ 시간 예산. TS(shared/generate.ts)가 호출마다 남은 시간(ms)을 이 헤더로 넘기고, Python 은 거기서 여유를 뺀 만큼 쓴다(D-409).
# 고정값끼리 나눠 쓰던 때(판정 7 + 문장 13 = TS 20초)는 왕복 여유가 0초였고 판정을 건너뛰어도 7초가 버려졌다.
BUDGET_HEADER = "x-rq-budget-ms"
# TS 마감보다 이만큼 먼저 돌려준다(왕복·JSON 처리 몫).
RESPONSE_MARGIN_S = 1.0
# 헤더 값이 커도 Vercel maxDuration 60 안에서 끝낸다.
MAX_BUDGET_S = 50.0
# 헤더가 없을 때 기본값. TS 35초(PROVIDER_TIMEOUT_MS) 안에 맞춘다.
FIRST_BUDGET_S = 33.0
# ③ 판정 상한: 헤더가 넉넉해도 이 이상 쓰지 않아 문장 몫을 남긴다(gpt-6-luna 측정 최대 6.5초, D-407).
JUDGE_BUDGET_S = 10.0
# ③ 문장 기본값(헤더 없을 때): 판정 10 + 문장 23 + 여유 < 35초.
FINAL_BUDGET_S = 23.0
RETRY_MIN_LEFT_S = 8.0
# 다시 쓰기 호출은 남은 시간보다 이만큼 일찍 끊어, 통과한 문항이 TS 마감 안에 돌아가게 한다.
REWRITE_SAFETY_S = 1.5


def budget_from_header(raw: str | None, default_s: float, cap_s: float = MAX_BUDGET_S) -> float:
    """헤더(남은 ms)가 있으면 그 값 − 여유(cap_s 안), 없거나 숫자가 아니면 기본값. 남은 시간이 여유보다 적으면 0."""
    if raw is None:
        return default_s
    try:
        left_s = float(raw) / 1000
    except ValueError:
        return default_s
    if not math.isfinite(left_s) or left_s < 0:
        return default_s
    return max(0.0, min(cap_s, left_s - RESPONSE_MARGIN_S))


# 국민연금 실시간 조회: 전체 예산, 호출 하나의 한도, 월별 동시 호출 수.
NPS_BUDGET_S = 20.0
NPS_CALL_TIMEOUT_S = 5.0
NPS_CONCURRENCY = 4

# ① 공고 분석: 엔드포인트 전체 마감(Vercel maxDuration 60 안), LLM 한 번의 상한, 단계별 최소 남은 시간.
ANALYSIS_DEADLINE_S = 50.0
ANALYSIS_LLM_MAX_S = 25.0
RECLASSIFY_MIN_LEFT_S = 15.0
SIGNAL_ASK_MIN_LEFT_S = 8.0

# ⓪ 카드 초안: 자료 출처 호출 하나의 한도.
CARD_SOURCE_CALL_TIMEOUT_S = 10.0

# ⓪ 카드 초안: 엔드포인트 마감, LLM 한 번의 상한, 다시 쓰기 문턱, 215L01 추천 호출 수 상한.
CARDS_DEADLINE_S = 55.0
CARDS_LLM_MAX_S = 45.0
CARDS_REWRITE_MIN_LEFT_S = 20.0
RECOMMEND_MAX_QUERIES = 20
# 추천에서만 온 능력단위가 후보를 덮지 않게 세분류 목록 밖 것은 이만큼만 더한다.
RECOMMEND_MAX_EXTRA_UNITS = 10
