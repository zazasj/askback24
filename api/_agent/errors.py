class ApiError(Exception):
    """응답 본문은 {"error": {"code", "message"}}. message에 요청 내용을 넣지 않는다."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
