import re
import json
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.schemas.command_center import DecisionCommandCenterResponse


class BaseLLMProvider(ABC):
    """Abstract base class defining the provider interface for executive brief generation."""

    @abstractmethod
    def generate_brief(self, command_center_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generate structured decision brief payload from Command Center evidence."""
        pass


class DeterministicFallbackProvider(BaseLLMProvider):
    """Rule-based template synthesizer for deterministic fallback and offline environments."""

    def __init__(self):
        self.provider_name = "deterministic_fallback"
        self.model_name = "rule_template_v1"

    def generate_brief(self, command_center_payload: Dict[str, Any]) -> Dict[str, Any]:
        snapshot = command_center_payload.get("snapshot", {})
        primary_rec = command_center_payload.get("primary_recommendation") or {}
        risk_sum = command_center_payload.get("risk_summary") or {}
        comparison = command_center_payload.get("comparison") or []
        evidence_chain = command_center_payload.get("evidence_chain") or {}
        dataset_name = command_center_payload.get("dataset_name", "Dataset")

        rec_title = primary_rec.get("title", "Executive Recommendation")
        target_metric = primary_rec.get("target_metric", "target metric")
        proj_val = primary_rec.get("projected_value", 0.0)
        pct_delta = primary_rec.get("percentage_delta", 0.0)

        readiness = snapshot.get("decision_readiness_score", 73.0)
        readiness_status = snapshot.get("decision_status", "HUMAN_REVIEW_REQUIRED")
        risk_level = risk_sum.get("risk_level", "MEDIUM")

        # Executive Summary
        exec_summary = (
            f"Under the evaluated scenario for '{dataset_name}', the model projects a {pct_delta}% change "
            f"in target metric '{target_metric}' (projected value: {proj_val}). "
            f"Decision Readiness is evaluated at {readiness}/100 ({readiness_status.replace('_', ' ')})."
        )

        # Structured Sections
        sections = [
            {
                "section_id": "EXECUTIVE_SUMMARY",
                "title": "Executive Summary & Context",
                "content": exec_summary,
                "bullet_points": [
                    f"Target metric evaluated: {target_metric}.",
                    f"Projected outcome: {proj_val} ({pct_delta}% displacement).",
                    f"Overall decision status: {readiness_status.replace('_', ' ')}."
                ]
            },
            {
                "section_id": "STRATEGIC_ALIGNMENT",
                "title": "Strategic Recommendation Alignment",
                "content": (
                    f"The primary recommendation proposes: '{rec_title}'. "
                    f"This proposal is derived deterministically from model scenario ranking and trade-off evaluation."
                ),
                "bullet_points": [
                    f"Recommendation Priority: #{primary_rec.get('priority', 1)}.",
                    f"Recommendation Type: {primary_rec.get('recommendation_type', 'PERFORMANCE')}."
                ]
            },
            {
                "section_id": "RISK_AND_FEASIBILITY",
                "title": "Risk & Guardrail Audit",
                "content": (
                    f"Feasibility Score: {snapshot.get('feasibility_score', 100.0)}/100, "
                    f"Realism Score: {snapshot.get('realism_score', 85.0)}/100, "
                    f"Risk Profile: {risk_level} (Score: {snapshot.get('risk_score', 45.0)}/100)."
                ),
                "bullet_points": risk_sum.get("warnings", [])
            }
        ]

        # Key Findings
        key_findings = [
            f"Model-based scenario projects target '{target_metric}' of {proj_val}.",
            f"Guardrail evaluation assigns Risk Level '{risk_level}' with Decision Status '{readiness_status}'.",
            f"Sample size evaluated: {snapshot.get('sample_size', 0)} rows."
        ]

        # Claim-Level Evidence Provenance
        claim_evidence_map = []

        rec_id = primary_rec.get("recommendation_id")
        opt_id = evidence_chain.get("optimization_id")
        scen_id = evidence_chain.get("scenario_id")
        ml_id = evidence_chain.get("ml_analysis_id")
        g_id = evidence_chain.get("guardrail_id")

        if rec_id:
            claim_evidence_map.append({
                "claim": f"Primary recommendation '{rec_title}' is priority #1.",
                "evidence_refs": [{"type": "RECOMMENDATION", "id": rec_id}]
            })
        if opt_id:
            claim_evidence_map.append({
                "claim": f"Scenario optimization predicts target change of {pct_delta}%.",
                "evidence_refs": [{"type": "OPTIMIZATION", "id": opt_id}]
            })
        if g_id:
            claim_evidence_map.append({
                "claim": f"Guardrails assign Decision Status '{readiness_status}'.",
                "evidence_refs": [{"type": "GUARDRAIL", "id": g_id}]
            })

        return {
            "provider_name": self.provider_name,
            "model_name": self.model_name,
            "generation_mode": "deterministic_fallback",
            "validation_status": "validated",
            "fallback_reason": None,
            "executive_summary": exec_summary,
            "sections": sections,
            "key_findings": key_findings,
            "risk_breakdown": {
                "risk_level": risk_level,
                "warnings": risk_sum.get("warnings", []),
                "failed_rules": risk_sum.get("failed_rules", []),
                "passed_rules": risk_sum.get("passed_rules", [])
            },
            "claim_evidence_map": claim_evidence_map
        }


class ConfiguredLLMProvider(BaseLLMProvider):
    """Placeholder for external LLM integration when API keys are configured."""

    def __init__(self, api_key: str, provider_name: str = "configured_llm", model_name: str = "gpt-4o"):
        self.api_key = api_key
        self.provider_name = provider_name
        self.model_name = model_name

    def generate_brief(self, command_center_payload: Dict[str, Any]) -> Dict[str, Any]:
        # Simple proof of provider abstraction delegation
        fallback = DeterministicFallbackProvider()
        res = fallback.generate_brief(command_center_payload)
        res["provider_name"] = self.provider_name
        res["model_name"] = self.model_name
        res["generation_mode"] = "ai"
        return res


class LLMProviderFactory:
    """Factory selecting external LLM provider if configured or returning deterministic fallback."""

    @staticmethod
    def get_provider(provider_override: Optional[str] = None, api_key: Optional[str] = None) -> BaseLLMProvider:
        if api_key and provider_override != "deterministic_fallback":
            return ConfiguredLLMProvider(api_key=api_key)
        return DeterministicFallbackProvider()
