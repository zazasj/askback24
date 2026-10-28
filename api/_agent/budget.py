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
