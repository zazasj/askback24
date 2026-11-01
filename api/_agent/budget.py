FIRST_BUDGET_S = 18.0
RETRY_MIN_LEFT_S = 8.0
# 다시 쓰기 호출은 남은 시간보다 이만큼 일찍 끊어, 통과한 문항이 TS의 20초 안에 돌아가게 한다.
REWRITE_SAFETY_S = 1.5
JUDGE_BUDGET_S = 8.0
FINAL_BUDGET_S = 10.0

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
