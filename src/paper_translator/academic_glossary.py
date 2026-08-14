from __future__ import annotations

import json
import re
from pathlib import Path

DEFAULT_GLOSSARY: dict[str, str] = {
    "confidence": "신뢰도",
    "deep neural network": "심층 신경망",
    "feed-forward planning": "피드포워드 계획",
    "friction": "마찰",
    "granular food": "입상 식품",
    "grasp": "파지",
    "grasp accuracy": "파지 정확도",
    "grasp point": "파지 지점",
    "low-uncertainty": "낮은 불확실성",
    "RGB-D image": "RGB-D 이미지",
    "self-supervised learning": "자기지도 학습",
    "target mass": "목표 질량",
    "target-mass grasping": "목표 질량 파지",
    "training dataset": "훈련 데이터셋",
    "uncertainty": "불확실성",
    "uncertainty estimation": "불확실성 추정",
    "user-specified target mass": "사용자 지정 목표 질량",
    "volumetric mass density": "체적 질량 밀도",
}


def default_glossary_path() -> Path:
    """사용자별 glossary 저장 경로를 반환한다."""
    return Path.home() / ".config" / "paper-translator" / "glossary.json"


class AcademicGlossary:
    """기본 학술용어와 사용자 지정 번역을 함께 관리한다."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or default_glossary_path()
        self._user_terms = self._load_user_terms()

    def terms_for_text(self, text: str) -> list[tuple[str, str]]:
        candidates: list[tuple[int, int, str, str]] = []
        for english, korean in self.all_terms().items():
            match = self._find_term(text, english)
            if match is not None:
                candidates.append((match.start(), match.end(), english, korean))

        selected: list[tuple[int, int, str, str]] = []
        for candidate in sorted(candidates, key=lambda item: (-(item[1] - item[0]), item[0])):
            start, end, _, _ = candidate
            overlaps = any(
                start < saved_end and end > saved_start
                for saved_start, saved_end, _, _ in selected
            )
            if not overlaps:
                selected.append(candidate)

        selected.sort(key=lambda item: item[0])
        return [(english, korean) for _, _, english, korean in selected]

    def all_terms_with_source(self) -> list[tuple[str, str, str]]:
        rows: list[tuple[str, str, str]] = []
        for english, korean in self.all_terms().items():
            source = "user" if self.is_user_term(english) else "default"
            rows.append((english, korean, source))
        return sorted(rows, key=lambda row: row[0].casefold())

    def all_terms(self) -> dict[str, str]:
        merged = dict(DEFAULT_GLOSSARY)
        for english, korean in self._user_terms.items():
            existing = self._find_case_insensitive_key(merged, english)
            if existing is not None:
                del merged[existing]
            merged[english] = korean
        return merged

    def is_user_term(self, english: str) -> bool:
        return self._find_case_insensitive_key(self._user_terms, english) is not None

    def save_term(self, english: str, korean: str) -> None:
        clean_english = " ".join(english.split())
        clean_korean = " ".join(korean.split())
        if not clean_english or not clean_korean:
            raise ValueError("영문 용어와 한국어 번역을 모두 입력하세요.")

        existing = self._find_case_insensitive_key(self._user_terms, clean_english)
        if existing is not None and existing != clean_english:
            del self._user_terms[existing]
        self._user_terms[clean_english] = clean_korean
        self._write_user_terms()

    def delete_user_term(self, english: str) -> None:
        existing = self._find_case_insensitive_key(self._user_terms, english)
        if existing is None:
            raise ValueError("사용자 glossary에 저장된 용어만 삭제할 수 있습니다.")
        del self._user_terms[existing]
        self._write_user_terms()

    def _load_user_terms(self) -> dict[str, str]:
        if not self.path.exists():
            return {}
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(payload, dict):
            return {}

        terms: dict[str, str] = {}
        for english, korean in payload.items():
            if isinstance(english, str) and isinstance(korean, str):
                clean_english = " ".join(english.split())
                clean_korean = " ".join(korean.split())
                if clean_english and clean_korean:
                    terms[clean_english] = clean_korean
        return terms

    def _write_user_terms(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            dict(sorted(self._user_terms.items(), key=lambda item: item[0].casefold())),
            ensure_ascii=False,
            indent=2,
        )
        self.path.write_text(payload + "\n", encoding="utf-8")

    @staticmethod
    def _find_term(text: str, term: str) -> re.Match[str] | None:
        pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
        return re.search(pattern, text, flags=re.IGNORECASE)

    @staticmethod
    def _find_case_insensitive_key(mapping: dict[str, str], target: str) -> str | None:
        target_key = target.casefold()
        for key in mapping:
            if key.casefold() == target_key:
                return key
        return None
