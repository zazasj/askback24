# 규칙 이름 → 고칠 점. 사용자 글은 넣지 않는 고정 문장만 쓴다.
HINTS = {
    "quote_not_in_posting": "공고 원문에 없는 말을 '…'로 인용하지 마세요",
    "absent_presupposition": "공고에 없는 업무를 공고에 있는 것처럼 말하지 마세요",
    "forbidden_word": "개인 사항·회사 평가 말을 쓰지 마세요",
    "experience_claim": "이 문항에는 구직자 경험을 쓰지 마세요",
    "too_long": "260자 안으로 줄이세요",
    "too_short": "질문 문장을 빠짐없이 쓰세요",
    "empty": "질문 문장을 빠짐없이 쓰세요",
    "missing": "질문 문장을 빠짐없이 쓰세요",
    "unknown_term": "공고에 없는 기술·분야 낱말을 빼고 다시 쓰세요",
    "interviewer_quote": "1차 면접관의 말을 옮기거나 '아까'·'말씀하신'으로 되짚지 마세요",
    "cushion_missing": "완충 문장을 문장 맨 앞에 글자 그대로 두세요",
    "cushion_leak": "완충 문장은 tone이 cushion인 문항의 맨 앞에만 한 번 쓰세요",
    "permission_twice": "'여쭤도 될까요?'처럼 허락을 구하는 말은 한 문항에 한 번만 쓰세요",
    "feeling_question": "'…궁금합니다.'로 맺거나 '…나요, 아니면 …인가요?'로 바로 물으세요",
    "ask_twice": "같은 것을 두 번 묻지 말고 '…궁금합니다.'나 물음 하나로만 맺으세요",
}


def hints_for(rules: list[str]) -> list[str]:
    return list(dict.fromkeys(HINTS[r] for r in rules if r in HINTS))
