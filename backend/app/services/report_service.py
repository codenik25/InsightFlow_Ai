import json
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.schemas.eda import KPIMetric
from app.schemas.report import (
    ExecutiveKPINode,
    ExecutiveHighlight,
    StrategicAction,
    ExecutiveReport,
)
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.insight_service import InsightService
from app.services.kpi_service import KPIService


class ReportService:
    """Deterministic, domain-agnostic Executive Summary & Report Export Engine."""

    @classmethod
    def sanitize_natural_phrasing(cls, text: str) -> str:
        """Sanitizes possessive constructions into domain-agnostic neutral phrasing."""
        if not text:
            return text
        # Replace possessive patterns like "X's stronger performance" -> "the stronger performance of X"
        text = re.sub(r"([A-Za-z0-9_\s]+)'s stronger performance", r"the stronger performance of \1", text)
        text = re.sub(r"([A-Za-z0-9_\s]+)'s higher average", r"the higher average of \1", text)
        text = re.sub(r"([A-Za-z0-9_\s]+)'s lowest", r"the lowest of \1", text)
        return text

    @classmethod
    def format_narrative_metric_phrase(cls, kpi: ExecutiveKPINode) -> str:
        """Formats a clean metric phrase avoiding duplicated 'total Total' or 'average Average' prefixes."""
        name = kpi.name
        name_lower = name.lower().strip()

        # If metric name already starts with Total or Average, use it cleanly
        if name_lower.startswith("total ") or name_lower.startswith("average "):
            return f"{name} of {kpi.formatted_value}"

        if kpi.aggregation == "sum":
            return f"total {name} of {kpi.formatted_value}"
        elif kpi.aggregation == "mean":
            return f"average {name} of {kpi.formatted_value}"
        else:
            return f"{name} of {kpi.formatted_value}"

    @classmethod
    def generate_executive_report(cls, db: Session, dataset_id: str) -> ExecutiveReport:
        """Consumes existing Phase 1-4 dataset artifacts to produce a deterministic Executive Report."""
        # 1. Resolve target dataset (raw -> processed child, or raise 400 if unprocessed)
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        raw_dataset_id = dataset_id if target_dataset.id != dataset_id else None

        source_dataset_name = target_dataset.name
        if target_dataset.parent_id:
            parent_ds = db.get(Dataset, target_dataset.parent_id)
            if parent_ds:
                source_dataset_name = parent_ds.name
        elif raw_dataset_id:
            raw_ds = db.get(Dataset, raw_dataset_id)
            if raw_ds:
                source_dataset_name = raw_ds.name

        # 2. Retrieve computed EDA & persisted insights
        eda = EDAService.get_eda(db=db, dataset_id=target_dataset.id)
        insight_res = InsightService.get_insights(db=db, dataset_id=target_dataset.id)

        # 3. Calculate Quality Score & Dataset Metadata
        profile = target_dataset.profile_data or {}
        quality_info = profile.get("quality_score", {})
        quality_score = float(quality_info.get("overall_score", 100.0))

        # 4. Construct Key KPI Nodes (Distinct Business Metric Prioritization)
        kpis_by_col: Dict[str, List[KPIMetric]] = {}
        for kpi in eda.discovered_kpis:
            # Exclude any misleading 'Total Unit Price' or total price KPIs for price_rate metrics
            if kpi.name.lower().startswith("total unit price") or (
                "price" in kpi.name.lower() and kpi.metric_type == "sum"
            ):
                continue

            col_key = (kpi.source_column or kpi.name).lower()
            if col_key not in kpis_by_col:
                kpis_by_col[col_key] = []
            kpis_by_col[col_key].append(kpi)

        selected_nodes: List[ExecutiveKPINode] = []
        for col_key, col_kpis in kpis_by_col.items():
            nature = KPIService.classify_measure_nature(col_key, pd.Series())

            if nature == "price_rate":
                best_kpi = next((k for k in col_kpis if k.metric_type == "mean"), col_kpis[0])
            elif nature in ("amount_value", "quantity_count"):
                best_kpi = next((k for k in col_kpis if k.metric_type == "sum"), col_kpis[0])
            else:
                best_kpi = col_kpis[0]

            val_fmt = (
                f"{int(best_kpi.value):,}"
                if (best_kpi.format == "integer" or best_kpi.value.is_integer())
                else f"{best_kpi.value:,.2f}"
            )

            selected_nodes.append(
                ExecutiveKPINode(
                    name=best_kpi.name,
                    value=best_kpi.value,
                    formatted_value=val_fmt,
                    aggregation=best_kpi.metric_type,
                    nature=nature,
                    reason=best_kpi.reason,
                )
            )

        def node_rank(node: ExecutiveKPINode) -> int:
            if node.nature == "amount_value":
                return 1
            if node.nature == "quantity_count":
                return 2
            if node.nature == "price_rate":
                return 3
            return 4

        selected_nodes.sort(key=node_rank)
        key_kpis = selected_nodes[:3]

        # 5. Classify & Sort Highlights (Deterministically ordered by priority_score DESC, then id ASC)
        achievements: List[ExecutiveHighlight] = []
        risks: List[ExecutiveHighlight] = []
        opportunities: List[ExecutiveHighlight] = []

        sorted_insights = sorted(
            insight_res.insights, key=lambda x: (-x.priority_score, x.id)
        )

        for ins in sorted_insights:
            hl = ExecutiveHighlight(
                id=ins.id,
                highlight_type="ACHIEVEMENT" if ins.severity == "POSITIVE" else ("RISK" if ins.severity in ("WARNING", "CRITICAL") else "OPPORTUNITY"),
                title=cls.sanitize_natural_phrasing(ins.title),
                summary=cls.sanitize_natural_phrasing(ins.observation),
                source_insight_id=ins.id,
                priority_score=ins.priority_score,
                evidence=ins.evidence.model_dump() if ins.evidence else None,
            )

            if ins.severity == "POSITIVE" and len(achievements) < 3:
                achievements.append(hl)
            elif ins.severity in ("WARNING", "CRITICAL") and len(risks) < 3:
                risks.append(hl)
            elif (ins.category == "OPPORTUNITY" or ins.severity == "INFO") and len(opportunities) < 3:
                opportunities.append(hl)

        # 6. Generate Strategic Actions (Max 3 unique actions representing distinct business concerns)
        strategic_actions: List[StrategicAction] = []
        seen_concern_keys = set()
        seen_recommendations = set()
        seen_action_titles = set()

        action_candidates = [
            i for i in sorted_insights if i.recommendation and len(i.recommendation.strip()) > 10
        ]

        buckets: Dict[str, List[Any]] = {"data_quality": [], "diversification": [], "performance": [], "other": []}
        for ins in action_candidates:
            cat = ins.category or "GENERAL"
            title_lower = ins.title.lower()
            obs_lower = ins.observation.lower()
            if cat == "DATA_QUALITY":
                buckets["data_quality"].append(ins)
            elif cat == "OPPORTUNITY" or "concentration" in title_lower or "concentration" in obs_lower or (ins.evidence and ins.evidence.contribution_percent and ins.evidence.contribution_percent >= 60.0):
                buckets["diversification"].append(ins)
            elif cat == "PERFORMANCE":
                buckets["performance"].append(ins)
            else:
                buckets["other"].append(ins)

        ordered_candidates: List[Any] = []
        if buckets["data_quality"]:
            ordered_candidates.append(buckets["data_quality"][0])
        if buckets["diversification"]:
            ordered_candidates.append(buckets["diversification"][0])
        if buckets["performance"]:
            ordered_candidates.append(buckets["performance"][0])

        for ins in action_candidates:
            if ins not in ordered_candidates:
                ordered_candidates.append(ins)

        for ins in ordered_candidates:
            cat = ins.category or "GENERAL"
            sev = ins.severity or "INFO"
            title_lower = ins.title.lower()
            obs_lower = ins.observation.lower()

            # Classify distinct strategic concern type to avoid duplicate metrics for the same concern
            if cat == "DATA_QUALITY":
                concern_type = "data_quality"
                act_title = "Protect Data Quality"
            elif cat == "OPPORTUNITY" or "concentration" in title_lower or "concentration" in obs_lower:
                m_label = InsightService.format_metric_label(ins.source_column or "Revenue")
                concern_type = f"diversification_{ins.source_column or 'all'}_{ins.dimension or 'all'}"
                act_title = f"Diversify {m_label} Concentration"
            elif cat == "PERFORMANCE":
                m_label = InsightService.format_metric_label(ins.source_column or "Performance")
                concern_type = f"performance_{ins.source_column or 'all'}_{ins.dimension or 'all'}"
                act_title = f"Optimize {m_label}"
            elif cat == "TREND":
                m_label = InsightService.format_metric_label(ins.source_column or "Trend")
                concern_type = f"trend_{ins.source_column or 'all'}"
                act_title = f"Monitor {m_label} Trajectory"
            elif cat == "CORRELATION":
                m_label = InsightService.format_metric_label(ins.source_column or "Correlation")
                concern_type = f"correlation_{ins.source_column or 'all'}"
                act_title = f"Investigate {m_label} Relationship"
            else:
                m_label = InsightService.format_metric_label(ins.source_column or "Metric")
                concern_type = f"general_{ins.source_column or 'all'}_{ins.dimension or 'all'}"
                act_title = f"Evaluate {m_label}"

            rec_clean = cls.sanitize_natural_phrasing(ins.recommendation.strip())

            # Skip if this strategic concern, action title, or exact recommendation text is already captured
            if (
                concern_type in seen_concern_keys
                or act_title.lower() in seen_action_titles
                or rec_clean.lower() in seen_recommendations
            ):
                continue

            seen_concern_keys.add(concern_type)
            seen_action_titles.add(act_title.lower())
            seen_recommendations.add(rec_clean.lower())

            strategic_actions.append(
                StrategicAction(
                    priority=len(strategic_actions) + 1,
                    title=act_title,
                    recommendation=rec_clean,
                    target_metric=ins.source_column,
                    target_dimension=ins.dimension,
                    source_insight_id=ins.id,
                )
            )

            if len(strategic_actions) >= 3:
                break

        # 7. Construct Executive Narrative
        top_achieve_str = achievements[0].title if achievements else "Dataset quality verified"
        top_risk_str = risks[0].title if risks else "No critical risk flags detected"

        additive_kpis = [k for k in key_kpis if k.nature in ("amount_value", "quantity_count")]
        non_additive_kpis = [k for k in key_kpis if k.nature == "price_rate"]

        primary_add_phrase = (
            cls.format_narrative_metric_phrase(additive_kpis[0])
            if additive_kpis
            else f"{target_dataset.row_count} records"
        )
        primary_non_add_phrase = (
            cls.format_narrative_metric_phrase(non_additive_kpis[0])
            if non_additive_kpis
            else ""
        )

        narrative_parts = [
            f"The analyzed processed dataset '{target_dataset.name}' contains {target_dataset.row_count:,} verified rows with an overall Data Quality Score of {quality_score:.1f}/100.",
            f"Primary metric evaluation highlights {primary_add_phrase}"
            + (f" alongside an {primary_non_add_phrase}." if primary_non_add_phrase else "."),
            f"Key operational highlights confirm that {cls.sanitize_natural_phrasing(top_achieve_str).lower()}, while strategic oversight indicates that {cls.sanitize_natural_phrasing(top_risk_str).lower()}.",
        ]
        executive_narrative = " ".join(narrative_parts)

        return ExecutiveReport(
            dataset_id=target_dataset.id,
            raw_dataset_id=raw_dataset_id,
            dataset_name=target_dataset.name,
            source_dataset_name=source_dataset_name,
            generated_at=datetime.now(timezone.utc).isoformat(),
            quality_score=quality_score,
            total_rows=target_dataset.row_count,
            total_columns=target_dataset.column_count,
            key_kpis=key_kpis,
            executive_narrative=executive_narrative,
            key_achievements=achievements,
            critical_risks=risks,
            key_opportunities=opportunities,
            strategic_actions=strategic_actions,
            total_insights_analyzed=len(insight_res.insights),
        )

    @classmethod
    def export_report_markdown(cls, report: ExecutiveReport) -> str:
        """Exports Executive Report as GitHub-Flavored Markdown."""
        lines = [
            "# Executive Summary Report",
            "",
            "## Dataset Overview",
            f"- **Processed Dataset Name**: `{report.dataset_name}`",
            f"- **Source Dataset**: `{report.source_dataset_name or report.dataset_name}`",
            f"- **Processed Dataset ID**: `{report.dataset_id}`",
            f"- **Data Quality Score**: `{report.quality_score:.1f}/100`",
            f"- **Total Rows**: `{report.total_rows:,}`",
            f"- **Total Columns**: `{report.total_columns}`",
            f"- **Report Generated At**: `{report.generated_at}`",
            "",
            "## Executive KPIs",
            "| Metric Name | Aggregation | Formatted Value | Metric Nature |",
            "| ----------- | ----------- | --------------- | ------------- |",
        ]

        for kpi in report.key_kpis:
            lines.append(
                f"| {kpi.name} | `{kpi.aggregation}` | **{kpi.formatted_value}** | `{kpi.nature}` |"
            )

        lines.extend([
            "",
            "## Executive Summary",
            report.executive_narrative,
            "",
            "## Key Achievements",
        ])

        if report.key_achievements:
            for item in report.key_achievements:
                lines.append(f"- **{item.title}**: {item.summary}")
        else:
            lines.append("- No positive highlights recorded.")

        lines.extend([
            "",
            "## Critical Risks",
        ])

        if report.critical_risks:
            for item in report.critical_risks:
                lines.append(f"- **{item.title}**: {item.summary}")
        else:
            lines.append("- No critical risk flags detected.")

        lines.extend([
            "",
            "## Strategic Actions",
        ])

        if report.strategic_actions:
            for act in report.strategic_actions:
                lines.append(f"{act.priority}. **{act.title}**: {act.recommendation}")
        else:
            lines.append("- Continue standard operational monitoring.")

        lines.extend([
            "",
            "## Evidence / Traceability",
            f"- **Total Persisted Insights Analyzed**: `{report.total_insights_analyzed}`",
            "- **Analytical Integrity**: All metrics derived deterministically from processed dataset storage without generative AI inference.",
            "",
        ])

        return "\n".join(lines)
