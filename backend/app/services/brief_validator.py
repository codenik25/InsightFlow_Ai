import re
import json
from typing import Dict, Any, List, Tuple


class BriefValidationError(Exception):
    """Custom exception raised when an AI generated brief fails validation."""
    pass


class DecisionBriefValidator:
    """Multi-stage validation pipeline for AI Decision Brief outputs."""

    PROHIBITED_CAUSAL_TERMS = [
        "causes", "caused", "will cause", "causal",
        "guarantees", "guaranteed", "will definitely",
        "proves that", "leads to", "certainly"
    ]

    @classmethod
    def validate_brief_payload(
        cls,
        brief_payload: Dict[str, Any],
        command_center_payload: Dict[str, Any],
        selected_recommendation_id: str,
    ) -> Tuple[bool, str]:
        """Execute full 5-stage validation pipeline on generated brief payload.

        Returns (is_valid, failure_reason).
        """
        try:
            # Stage 1: Schema & Content Completeness Validation
            cls._validate_schema(brief_payload)

            # Stage 2: Evidence Reference Validation
            cls._validate_evidence_references(brief_payload, command_center_payload)

            # Stage 3: Numeric Consistency Validation
            cls._validate_numeric_consistency(brief_payload, command_center_payload)

            # Stage 4: Non-Causal Language Validation
            cls._validate_non_causal_language(brief_payload)

            # Stage 5: Immutability & Recommendation Consistency Validation
            cls._validate_immutability(brief_payload, command_center_payload, selected_recommendation_id)

            return True, "validated"
        except BriefValidationError as e:
            return False, str(e)
        except Exception as ex:
            return False, f"Unexpected validation error: {str(ex)}"

    @classmethod
    def _validate_schema(cls, brief_payload: Dict[str, Any]):
        exec_summary = brief_payload.get("executive_summary")
        if not exec_summary or not isinstance(exec_summary, str) or len(exec_summary.strip()) < 10:
            raise BriefValidationError("Executive summary is missing or empty.")

        sections = brief_payload.get("sections")
        if not isinstance(sections, list) or len(sections) == 0:
            raise BriefValidationError("Brief sections list is missing or empty.")

    @classmethod
    def _validate_evidence_references(cls, brief_payload: Dict[str, Any], command_center_payload: Dict[str, Any]):
        # Extract all valid evidence IDs from Command Center payload
        valid_ids = set()
        primary_rec = command_center_payload.get("primary_recommendation") or {}
        if primary_rec.get("recommendation_id"):
            valid_ids.add(primary_rec["recommendation_id"])

        for alt in command_center_payload.get("alternative_recommendations", []):
            if alt.get("recommendation_id"):
                valid_ids.add(alt["recommendation_id"])

        chain = command_center_payload.get("evidence_chain") or {}
        for node in chain.get("nodes", []):
            if node.get("node_id"):
                valid_ids.add(node["node_id"])

        if chain.get("optimization_id"):
            valid_ids.add(chain["optimization_id"])
        if chain.get("scenario_id"):
            valid_ids.add(chain["scenario_id"])
        if chain.get("ml_analysis_id"):
            valid_ids.add(chain["ml_analysis_id"])
        if chain.get("guardrail_id"):
            valid_ids.add(chain["guardrail_id"])
        for ins_id in chain.get("insight_ids", []):
            valid_ids.add(ins_id)

        # Validate claim evidence map references
        claim_map = brief_payload.get("claim_evidence_map", [])
        for item in claim_map:
            refs = item.get("evidence_refs", [])
            for ref in refs:
                ref_id = ref.get("id")
                if not ref_id or ref_id not in valid_ids:
                    raise BriefValidationError(f"Claim evidence reference ID '{ref_id}' is invalid or fabricated.")

    @classmethod
    def _validate_numeric_consistency(cls, brief_payload: Dict[str, Any], command_center_payload: Dict[str, Any]):
        # Extract all numeric values from Command Center evidence
        command_center_numbers = cls._extract_numbers_from_json(command_center_payload)

        # Extract numbers from generated executive summary and sections
        text_to_check = brief_payload.get("executive_summary", "")
        for s in brief_payload.get("sections", []):
            text_to_check += " " + s.get("content", "")
            text_to_check += " " + " ".join(s.get("bullet_points", []))

        text_numbers = cls._extract_numbers_from_text(text_to_check)

        # Ensure all numbers in generated text exist in Command Center payload (with tolerance for rounding)
        for num in text_numbers:
            if not cls._is_number_supported(num, command_center_numbers):
                raise BriefValidationError(f"Numerical claim '{num}' in brief text is not supported by Command Center evidence.")

    @classmethod
    def _validate_non_causal_language(cls, brief_payload: Dict[str, Any]):
        text_to_check = brief_payload.get("executive_summary", "").lower()
        for s in brief_payload.get("sections", []):
            text_to_check += " " + s.get("content", "").lower()

        for term in cls.PROHIBITED_CAUSAL_TERMS:
            if re.search(r'\b' + re.escape(term) + r'\b', text_to_check):
                raise BriefValidationError(f"Prohibited causal term '{term}' found in brief text.")

    @classmethod
    def _validate_immutability(cls, brief_payload: Dict[str, Any], command_center_payload: Dict[str, Any], selected_rec_id: str):
        primary_rec = command_center_payload.get("primary_recommendation") or {}
        if primary_rec.get("recommendation_id") and primary_rec["recommendation_id"] != selected_rec_id:
            raise BriefValidationError(f"Recommendation mismatch: expected '{selected_rec_id}', got '{primary_rec.get('recommendation_id')}'.")

    @classmethod
    def _extract_numbers_from_json(cls, obj: Any) -> set:
        numbers = set()
        if isinstance(obj, (int, float)):
            numbers.add(round(float(obj), 2))
            numbers.add(round(float(obj), 0))
        elif isinstance(obj, dict):
            for v in obj.values():
                numbers.update(cls._extract_numbers_from_json(v))
        elif isinstance(obj, list):
            for item in obj:
                numbers.update(cls._extract_numbers_from_json(item))
        elif isinstance(obj, str):
            for n in cls._extract_numbers_from_text(obj):
                numbers.add(n)
        return numbers

    @classmethod
    def _extract_numbers_from_text(cls, text: str) -> List[float]:
        # Extract floating numbers, integers, percentages
        matches = re.findall(r'[-+]?\d*\.\d+|\d+', text)
        nums = []
        for m in matches:
            try:
                val = float(m)
                # Ignore small single-digit integers used for priority ranks or list indices
                if val in [1.0, 2.0, 3.0, 4.0, 5.0, 100.0]:
                    continue
                nums.append(round(val, 2))
            except ValueError:
                pass
        return nums

    @classmethod
    def _is_number_supported(cls, num: float, valid_numbers: set) -> bool:
        for val in valid_numbers:
            if abs(num - val) < 0.05 or abs(num - (val * 100.0)) < 0.5:
                return True
        return False
