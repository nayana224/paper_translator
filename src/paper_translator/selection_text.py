import re


def normalize_selected_text(text: str) -> str:
    """브라우저에서 선택한 논문 텍스트의 불필요한 공백을 정리한다."""
    normalized = text.replace("\u00ad", "")
    normalized = re.sub(r"-\s*\n\s*", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()
