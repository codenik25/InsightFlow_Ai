import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.insight import DatasetInsight
from app.schemas.insight import (
    Insight,
    InsightEvidence,
    InsightSummary,
    InsightResponse,
)
from app.services.dataset_service import DatasetService
from app.services.kpi_service import KPIService
from app.services.eda_service import EDAService


class InsightService:
    """Deterministic, domain-agnostic Business Insight Discovery Engine."""

    @classmethod
    def format_metric_label(cls, col_name: str) -> str:
        """Centralized metric display-name mapping/helper avoiding duplicate 'Total' prefixes."""
        col_lower = col_name.lower().replace("-", "_")
        if col_lower == "total_revenue":
            return "Total Revenue"
        if col_lower == "units_sold":
            return "Units Sold"
        if col_lower == "unit_price":
            return "Unit Price"

        # General snake_case to Title Case conversion
        clean = col_name.replace("_", " ").replace("-", " ").title()
        if clean.startswith("Total Total "):
            clean = clean[6:]  # remove duplicated 'Total '
        return clean

    @classmethod
    def format_dimension_plural(cls, dim_name: str) -> str:
        """Centralized dimension pluralization helper (e.g. 'category' -> 'categories')."""
        dim_lower = dim_name.lower().replace("_", " ").replace("-", " ")
        if dim_lower == "category":
            return "categories"
        if dim_lower == "product":
            return "products"
        if dim_lower == "region":
            return "regions"
        if dim_lower.endswith("y"):
            return f"{dim_lower[:-1]}ies"
        return f"{dim_lower}s"

    @classmethod
    def generate_insights(cls, db: Session, dataset_id: str) -> InsightResponse:
        # Resolve target processed dataset using existing EDAService validation
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        # Retrieve computed EDA response (guaranteed on processed dataset)
        eda = EDAService.get_eda(db=db, dataset_id=target_dataset.id)

        insights: List[Insight] = []

        # ----------------------------------------------------
        # 1. DATA QUALITY INSIGHTS
        # ----------------------------------------------------
        overview = eda.overview_kpis
        if overview.total_missing_cells == 0 and overview.duplicate_rows == 0:
            insights.append(
                Insight(
                    id=str(uuid.uuid4()),
                    dataset_id=target_dataset.id,
                    category="DATA_QUALITY",
                    severity="POSITIVE",
                    title="Dataset quality verified and cleaned",
                    observation=f"Dataset contains 0 missing cells and 0 duplicate rows across {overview.total_rows} rows.",
                    evidence=InsightEvidence(
                        sample_size=overview.total_rows,
                        total_value=overview.total_rows,
                        quality_score_after=100.0,
                    ),
                    explanation="Clean tabular data ensures downstream analytics, KPIs, and visualizations remain accurate.",
                    recommendation="The processed dataset is verified and safe for reporting.",
                    priority_score=95.0,
                    confidence=1.0,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )

        # ----------------------------------------------------
        # 2. CATEGORY BREAKDOWN INSIGHTS (PERFORMANCE & CONCENTRATION)
        # ----------------------------------------------------
        for breakdown in eda.category_breakdowns:
            dim = breakdown.dimension
            m = breakdown.measure
            top_cat = breakdown.top_category
            bottom_cat = breakdown.bottom_category
            grouped = breakdown.grouped_data

            # Classify measure nature to enforce non-additive metric rules (e.g. unit_price, rate, cost)
            nature = KPIService.classify_measure_nature(m, pd.Series())
            is_non_additive = (nature == "price_rate") or (breakdown.aggregation_method == "mean")

            dim_plural = cls.format_dimension_plural(dim)
            m_label = cls.format_metric_label(m)

            if top_cat:
                second_best = grouped[1] if len(grouped) > 1 else None
                diff_val = round(top_cat.metric_value - (second_best.metric_value if second_best else 0.0), 2)

                # A. Top Performer Insight
                if is_non_additive:
                    # Non-additive metric (unit_price, rate): Use absolute difference comparison (no percentage comparison, contribution %, or sum total)
                    top_fmt = f"{top_cat.metric_value:,.2f}"
                    diff_fmt = f"{diff_val:,.2f}"

                    if second_best:
                        second_fmt = f"{second_best.metric_value:,.2f}"
                        obs_str = f"{top_cat.category_value} has the highest average {m_label} among {dim_plural} at {top_fmt}, which is {diff_fmt} higher than {second_best.category_value} ({second_fmt})."
                    else:
                        obs_str = f"{top_cat.category_value} has the highest average {m_label} among {dim_plural} at {top_fmt}."

                    insights.append(
                        Insight(
                            id=str(uuid.uuid4()),
                            dataset_id=target_dataset.id,
                            category="PERFORMANCE",
                            severity="POSITIVE",
                            title=f"{top_cat.category_value} has the highest average {m_label}",
                            observation=obs_str,
                            evidence=InsightEvidence(
                                dimension=dim,
                                metric=m,
                                top_value=top_cat.category_value,
                                total_value=None,  # Exclude non-additive sum total
                                contribution_percent=None,  # Exclude non-additive contribution %
                                second_best_value=second_best.category_value if second_best else None,
                                comparison_diff=diff_val,
                                details={
                                    "aggregation": "mean",
                                    "top_metric_value": top_cat.metric_value,
                                    "second_best_metric_value": second_best.metric_value if second_best else None,
                                    "difference": diff_val,
                                },
                            ),
                            explanation=f"Comparing average {m_label} across {dim_plural} highlights pricing and rate variation.",
                            recommendation=f"Consider investigating what operational or market factors contribute to the higher average {m_label} of {top_cat.category_value}.",
                            priority_score=72.0,
                            confidence=1.0,
                            source_column=m,
                            dimension=dim,
                            metric_value=top_cat.metric_value,
                            created_at=datetime.now(timezone.utc).isoformat(),
                        )
                    )
                else:
                    # Additive metric (total_revenue, units_sold): Use sum contribution wording
                    insights.append(
                        Insight(
                            id=str(uuid.uuid4()),
                            dataset_id=target_dataset.id,
                            category="PERFORMANCE",
                            severity="POSITIVE",
                            title=f"{top_cat.category_value} generated the highest {m_label}",
                            observation=f"{top_cat.category_value} generated the highest {m_label} among {dim_plural}, contributing {top_cat.contribution_pct}% of the total.",
                            evidence=InsightEvidence(
                                dimension=dim,
                                metric=m,
                                top_value=top_cat.category_value,
                                total_value=breakdown.total_measure_value,
                                contribution_percent=top_cat.contribution_pct,
                                second_best_value=second_best.category_value if second_best else None,
                                comparison_diff=diff_val,
                                details={"aggregation": "sum"},
                            ),
                            explanation=f"Performance evaluation highlights {top_cat.category_value} as the leading driver of overall {m_label}.",
                            recommendation=f"Consider investigating what operational factors contribute to the stronger performance of {top_cat.category_value}.",
                            priority_score=round(70.0 + (top_cat.contribution_pct * 0.2), 2),
                            confidence=1.0,
                            source_column=m,
                            dimension=dim,
                            metric_value=top_cat.metric_value,
                            created_at=datetime.now(timezone.utc).isoformat(),
                        )
                    )

                # B. Concentration Risk / Opportunity Insight (ONLY generated for ADDITIVE metrics!)
                if not is_non_additive and top_cat.contribution_pct >= 60.0 and breakdown.total_measure_value > 0:
                    sev = "WARNING" if top_cat.contribution_pct >= 80.0 else "INFO"
                    conc_label = "High" if top_cat.contribution_pct >= 80.0 else "Notable"
                    insights.append(
                        Insight(
                            id=str(uuid.uuid4()),
                            dataset_id=target_dataset.id,
                            category="OPPORTUNITY" if sev == "INFO" else "PERFORMANCE",
                            severity=sev,
                            title=f"{conc_label} {m_label} concentration in {top_cat.category_value}",
                            observation=f"{top_cat.category_value} accounts for {top_cat.contribution_pct}% of overall {m_label}.",
                            evidence=InsightEvidence(
                                dimension=dim,
                                metric=m,
                                top_value=top_cat.category_value,
                                total_value=breakdown.total_measure_value,
                                contribution_percent=top_cat.contribution_pct,
                                details={"aggregation": "sum"},
                            ),
                            explanation=f"High concentration indicates substantial metric dependence on a single {dim} category.",
                            recommendation=f"Evaluate strategies to diversify metric contributions across other {dim_plural}.",
                            priority_score=round(85.0 if top_cat.contribution_pct >= 80.0 else 65.0, 2),
                            confidence=1.0,
                            source_column=m,
                            dimension=dim,
                            metric_value=top_cat.metric_value,
                            created_at=datetime.now(timezone.utc).isoformat(),
                        )
                    )

            # C. Lowest Performer Insight
            if bottom_cat and len(grouped) > 1 and top_cat and bottom_cat.category_value != top_cat.category_value:
                bottom_fmt = f"{bottom_cat.metric_value:,.2f}"
                if is_non_additive:
                    insights.append(
                        Insight(
                            id=str(uuid.uuid4()),
                            dataset_id=target_dataset.id,
                            category="PERFORMANCE",
                            severity="WARNING",
                            title=f"{bottom_cat.category_value} has the lowest average {m_label} among {dim_plural}",
                            observation=f"{bottom_cat.category_value} has the lowest average {m_label} among {dim_plural} at {bottom_fmt}.",
                            evidence=InsightEvidence(
                                dimension=dim,
                                metric=m,
                                top_value=bottom_cat.category_value,
                                total_value=None,  # Do NOT generate total_value
                                contribution_percent=None,  # Do NOT generate contribution_percent
                                details={"aggregation": "mean", "bottom_metric_value": bottom_cat.metric_value},
                            ),
                            explanation=f"Identifying lower average {m_label} across {dim_plural} provides visibility into pricing and rate disparities.",
                            recommendation=f"Worth investigating whether targeted adjustments could improve unit rate/price performance for {bottom_cat.category_value}.",
                            priority_score=55.0,
                            confidence=1.0,
                            source_column=m,
                            dimension=dim,
                            metric_value=bottom_cat.metric_value,
                            created_at=datetime.now(timezone.utc).isoformat(),
                        )
                    )
                else:
                    insights.append(
                        Insight(
                            id=str(uuid.uuid4()),
                            dataset_id=target_dataset.id,
                            category="PERFORMANCE",
                            severity="WARNING",
                            title=f"{bottom_cat.category_value} recorded the lowest {m_label} among {dim_plural}",
                            observation=f"{bottom_cat.category_value} recorded the lowest {m_label} among {dim_plural} with a contribution of {bottom_cat.contribution_pct}%.",
                            evidence=InsightEvidence(
                                dimension=dim,
                                metric=m,
                                top_value=bottom_cat.category_value,
                                total_value=breakdown.total_measure_value,
                                contribution_percent=bottom_cat.contribution_pct,
                                details={"aggregation": "sum"},
                            ),
                            explanation=f"Identifying lower performing {dim_plural} provides visibility into underutilized potential.",
                            recommendation=f"Worth investigating whether targeted adjustments could improve performance for {bottom_cat.category_value}.",
                            priority_score=55.0,
                            confidence=1.0,
                            source_column=m,
                            dimension=dim,
                            metric_value=bottom_cat.metric_value,
                            created_at=datetime.now(timezone.utc).isoformat(),
                        )
                    )

        # ----------------------------------------------------
        # 3. TIME-SERIES TREND INSIGHTS (TREND)
        # ----------------------------------------------------
        for trend in eda.trends:
            if trend.trend_direction == "insufficient_data" or not trend.time_series or len(trend.time_series) < 2:
                continue

            # Zero-baseline safety check
            if trend.first_period_value is None or trend.first_period_value == 0:
                continue

            m_label = cls.format_metric_label(trend.measure)
            sev = "POSITIVE" if trend.trend_direction == "increasing" else ("WARNING" if trend.trend_direction == "decreasing" else "INFO")
            pct_str = f"+{trend.pct_change}%" if trend.pct_change > 0 else f"{trend.pct_change}%"

            insights.append(
                Insight(
                    id=str(uuid.uuid4()),
                    dataset_id=target_dataset.id,
                    category="TREND",
                    severity=sev,
                    title=f"{m_label} is {trend.trend_direction} over the analyzed period",
                    observation=f"{m_label} changed by {pct_str} from {trend.first_period_value} to {trend.latest_period_value} across {trend.granularity} periods.",
                    evidence=InsightEvidence(
                        dimension=trend.datetime_column,
                        metric=trend.measure,
                        top_value=trend.latest_period_value,
                        total_value=trend.first_period_value,
                        contribution_percent=trend.pct_change,
                        sample_size=len(trend.time_series),
                    ),
                    explanation=f"Time-series trend analysis tracks sequential velocity over {trend.granularity} periods.",
                    recommendation=f"Monitor period-over-period velocity to confirm whether this {trend.trend_direction} trajectory is sustained.",
                    priority_score=round(80.0 if abs(trend.pct_change) > 20 else 60.0, 2),
                    confidence=1.0,
                    source_column=trend.measure,
                    dimension=trend.datetime_column,
                    metric_value=trend.latest_period_value,
                    comparison_value=trend.first_period_value,
                    percentage_change=trend.pct_change,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )

        # ----------------------------------------------------
        # 4. PEARSON CORRELATION INSIGHTS (CORRELATION)
        # ----------------------------------------------------
        for rel in eda.relationships:
            abs_r = abs(rel.correlation)
            if abs_r < 0.30:
                continue  # Skip weak correlations to maintain high signal-to-noise ratio

            strength_label = "Strong" if abs_r >= 0.70 else "Moderate"
            dir_label = "positive" if rel.correlation > 0 else "negative"

            col_a_label = cls.format_metric_label(rel.column_a)
            col_b_label = cls.format_metric_label(rel.column_b)

            sev = "POSITIVE" if (rel.correlation > 0 and abs_r >= 0.70) else ("WARNING" if rel.correlation < -0.5 else "INFO")

            insights.append(
                Insight(
                    id=str(uuid.uuid4()),
                    dataset_id=target_dataset.id,
                    category="CORRELATION",
                    severity=sev,
                    title=f"{col_a_label} and {col_b_label} show a {strength_label.lower()} {dir_label} correlation",
                    observation=f"{col_a_label} and {col_b_label} have a Pearson correlation coefficient r = {rel.correlation}.",
                    evidence=InsightEvidence(
                        metric=f"{rel.column_a} vs {rel.column_b}",
                        correlation=rel.correlation,
                    ),
                    explanation="Correlation measures linear co-movement between numeric metrics. Note that correlation does not imply direct causation.",
                    recommendation="Further domain investigation is recommended before drawing causal conclusions.",
                    priority_score=round(75.0 if abs_r >= 0.70 else 50.0, 2),
                    confidence=1.0,
                    source_column=rel.column_a,
                    dimension=rel.column_b,
                    metric_value=rel.correlation,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )

        # ----------------------------------------------------
        # 5. SORT INSIGHTS BY PRIORITY SCORE DESCENDING
        # ----------------------------------------------------
        insights.sort(key=lambda x: x.priority_score, reverse=True)

        # ----------------------------------------------------
        # 6. PERSIST INSIGHTS IN POSTGRESQL TABLE
        # ----------------------------------------------------
        existing_stmt = select(DatasetInsight).where(DatasetInsight.dataset_id == target_dataset.id)
        existing_records = db.scalars(existing_stmt).all()
        for rec in existing_records:
            db.delete(rec)

        db_records = []
        for ins in insights:
            rec = DatasetInsight(
                id=ins.id,
                dataset_id=target_dataset.id,
                category=ins.category,
                severity=ins.severity,
                title=ins.title,
                observation=ins.observation,
                evidence=ins.evidence.model_dump(),
                explanation=ins.explanation,
                recommendation=ins.recommendation,
                priority_score=ins.priority_score,
                confidence=ins.confidence,
                source_column=ins.source_column,
                dimension=ins.dimension,
                metric_value=ins.metric_value,
                comparison_value=ins.comparison_value,
                percentage_change=ins.percentage_change,
            )
            db_records.append(rec)

        db.add_all(db_records)
        db.commit()

        # Build Summary metrics
        crit_cnt = sum(1 for i in insights if i.severity == "CRITICAL")
        warn_cnt = sum(1 for i in insights if i.severity == "WARNING")
        pos_cnt = sum(1 for i in insights if i.severity == "POSITIVE")
        info_cnt = sum(1 for i in insights if i.severity == "INFO")
        opp_cnt = sum(1 for i in insights if i.category == "OPPORTUNITY")

        summary = InsightSummary(
            total=len(insights),
            critical_count=crit_cnt,
            warning_count=warn_cnt,
            positive_count=pos_cnt,
            info_count=info_cnt,
            opportunity_count=opp_cnt,
        )

        return InsightResponse(
            dataset_id=target_dataset.id,
            summary=summary,
            insights=insights,
        )

    @classmethod
    def get_insights(cls, db: Session, dataset_id: str) -> InsightResponse:
        """Retrieve stored insights or generate on-the-fly for the resolved processed dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        stmt = (
            select(DatasetInsight)
            .where(DatasetInsight.dataset_id == target_dataset.id)
            .order_by(DatasetInsight.priority_score.desc())
        )
        records = list(db.scalars(stmt).all())

        if records:
            insights = [
                Insight(
                    id=r.id,
                    dataset_id=r.dataset_id,
                    category=r.category,
                    severity=r.severity,
                    title=r.title,
                    observation=r.observation,
                    evidence=InsightEvidence(**(r.evidence or {})),
                    explanation=r.explanation,
                    recommendation=r.recommendation,
                    priority_score=r.priority_score,
                    confidence=r.confidence,
                    source_column=r.source_column,
                    dimension=r.dimension,
                    metric_value=r.metric_value,
                    comparison_value=r.comparison_value,
                    percentage_change=r.percentage_change,
                    created_at=r.created_at.isoformat(),
                )
                for r in records
            ]

            crit_cnt = sum(1 for i in insights if i.severity == "CRITICAL")
            warn_cnt = sum(1 for i in insights if i.severity == "WARNING")
            pos_cnt = sum(1 for i in insights if i.severity == "POSITIVE")
            info_cnt = sum(1 for i in insights if i.severity == "INFO")
            opp_cnt = sum(1 for i in insights if i.category == "OPPORTUNITY")

            summary = InsightSummary(
                total=len(insights),
                critical_count=crit_cnt,
                warning_count=warn_cnt,
                positive_count=pos_cnt,
                info_count=info_cnt,
                opportunity_count=opp_cnt,
            )

            return InsightResponse(
                dataset_id=target_dataset.id,
                summary=summary,
                insights=insights,
            )

        # Fallback to generate
        return cls.generate_insights(db=db, dataset_id=target_dataset.id)
