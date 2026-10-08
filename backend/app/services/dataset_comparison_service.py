import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Set
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logging import logger
from app.models.dataset import Dataset
from app.models.insight import DatasetInsight
from app.models.ml_analysis import MLAnalysis
from app.schemas.comparison import (
    ComparisonSummary,
    SchemaChange,
    QualityChangeDetail,
    MetricChange,
    DistributionChange,
    InsightImpact,
    PredictionImpact,
    DatasetComparisonResponse,
    DatasetVersionItem,
    DatasetFamilyGroup,
    DatasetVersionListResponse,
)
from app.services.dataset_service import DatasetService
from app.services.quality_service import QualityService


class DatasetComparisonService:
    """Deterministic, explainable 'What Changed?' engine comparing two dataset versions."""

    @classmethod
    def get_logical_lineage_name(cls, db: Session, ds: Dataset) -> str:
        """Derive the canonical logical dataset lineage name from raw or processed dataset."""
        if ds.is_processed and ds.parent_id:
            parent = db.scalar(select(Dataset).where(Dataset.id == ds.parent_id))
            if parent and parent.name:
                return parent.name
        return ds.name

    @classmethod
    def get_dataset_versions(cls, db: Session, dataset_id: str) -> DatasetVersionListResponse:
        """Fetch all versions in the same logical dataset lineage as the given dataset."""
        dataset = DatasetService.get_dataset_by_id(db, dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset '{dataset_id}' not found.",
            )

        lineage_name = cls.get_logical_lineage_name(db, dataset)
        project_id = dataset.project_id

        stmt = select(Dataset).where(
            func.lower(Dataset.name) == func.lower(lineage_name),
            Dataset.is_processed == False,
        )
        if project_id:
            stmt = stmt.where(Dataset.project_id == project_id)
        else:
            stmt = stmt.where(Dataset.project_id.is_(None))

        stmt = stmt.order_by(Dataset.version.desc(), Dataset.created_at.desc())
        raw_datasets = list(db.scalars(stmt).all())

        raw_ids = [d.id for d in raw_datasets]
        processed_map: Dict[str, str] = {}
        if raw_ids:
            proc_stmt = select(Dataset.id, Dataset.parent_id).where(
                Dataset.parent_id.in_(raw_ids),
                Dataset.is_processed == True,
            )
            for p_id, p_parent_id in db.execute(proc_stmt).all():
                if p_parent_id:
                    processed_map[p_parent_id] = p_id

        items = [
            cls._to_version_item(
                d,
                lineage_name=lineage_name,
                processed_child_id=processed_map.get(d.id),
            )
            for d in raw_datasets
        ]

        family = DatasetFamilyGroup(
            lineage_name=lineage_name,
            total_versions=len(items),
            versions=items,
        )

        return DatasetVersionListResponse(
            project_id=project_id,
            lineage_name=lineage_name,
            total_versions=len(items),
            versions=items,
            lineages=[lineage_name],
            families=[family],
        )

    @classmethod
    def get_project_versions(
        cls, db: Session, project_id: str, lineage: Optional[str] = None
    ) -> DatasetVersionListResponse:
        """Fetch raw dataset versions for a project, optionally filtered by lineage/name, and grouped by family."""
        # Discover all distinct raw lineage names in this project
        lineage_stmt = (
            select(Dataset.name)
            .where(Dataset.project_id == project_id, Dataset.is_processed == False)
            .distinct()
            .order_by(Dataset.name.asc())
        )
        distinct_lineages = list(db.scalars(lineage_stmt).all())

        # Pre-fetch all raw datasets in this project ordered by version desc
        all_raw_stmt = (
            select(Dataset)
            .where(Dataset.project_id == project_id, Dataset.is_processed == False)
            .order_by(Dataset.version.desc(), Dataset.created_at.desc())
        )
        all_raw_datasets = list(db.scalars(all_raw_stmt).all())

        raw_ids = [d.id for d in all_raw_datasets]
        processed_map: Dict[str, str] = {}
        if raw_ids:
            proc_stmt = select(Dataset.id, Dataset.parent_id).where(
                Dataset.parent_id.in_(raw_ids),
                Dataset.is_processed == True,
            )
            for p_id, p_parent_id in db.execute(proc_stmt).all():
                if p_parent_id:
                    processed_map[p_parent_id] = p_id

        # Build family groups
        families: List[DatasetFamilyGroup] = []
        for lin in distinct_lineages:
            lin_raw = [d for d in all_raw_datasets if d.name.lower() == lin.lower()]
            lin_items = [
                cls._to_version_item(
                    d,
                    lineage_name=lin,
                    processed_child_id=processed_map.get(d.id),
                )
                for d in lin_raw
            ]
            families.append(
                DatasetFamilyGroup(
                    lineage_name=lin,
                    total_versions=len(lin_items),
                    versions=lin_items,
                )
            )

        # Determine target lineage if specified, or default to first lineage if multiple
        target_lineage = lineage
        if target_lineage:
            matching = next((f for f in families if f.lineage_name.lower() == target_lineage.lower()), None)
            items = matching.versions if matching else []
        elif families:
            target_lineage = families[0].lineage_name
            items = families[0].versions
        else:
            target_lineage = None
            items = []

        return DatasetVersionListResponse(
            project_id=project_id,
            lineage_name=target_lineage,
            total_versions=len(items),
            versions=items,
            lineages=distinct_lineages,
            families=families,
        )

    @classmethod
    def _to_version_item(
        cls,
        ds: Dataset,
        lineage_name: Optional[str] = None,
        processed_child_id: Optional[str] = None,
    ) -> DatasetVersionItem:
        q_score = None
        if ds.profile_data and isinstance(ds.profile_data, dict):
            if "quality_score" in ds.profile_data:
                q_score = float(ds.profile_data["quality_score"])
            elif "score" in ds.profile_data and isinstance(ds.profile_data["score"], dict):
                q_score = float(ds.profile_data["score"].get("overall_score", 0.0))

        reg_status = "READY"
        if ds.status in ["uploaded", "processing"]:
            reg_status = "PROCESSING"
        elif ds.status == "failed":
            reg_status = "FAILED"

        return DatasetVersionItem(
            id=ds.id,
            project_id=ds.project_id,
            version=ds.version or 1,
            name=ds.name,
            description=ds.description,
            row_count=ds.row_count,
            column_count=ds.column_count,
            file_size_bytes=ds.file_size_bytes,
            quality_score=q_score,
            status=reg_status,
            is_processed=ds.is_processed,
            parent_id=ds.parent_id,
            lineage_name=lineage_name or ds.name,
            has_processed_child=processed_child_id is not None,
            processed_child_id=processed_child_id,
            created_at=ds.created_at,
            updated_at=ds.updated_at,
        )

    @classmethod
    def compare_datasets(
        cls,
        db: Session,
        base_dataset_id: str,
        comparison_dataset_id: str,
    ) -> DatasetComparisonResponse:
        """Perform comprehensive deterministic comparison between base and comparison dataset versions."""
        # 1. Fetch datasets
        base_ds = DatasetService.get_dataset_by_id(db, base_dataset_id)
        if not base_ds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Base dataset '{base_dataset_id}' not found.",
            )

        comp_ds = DatasetService.get_dataset_by_id(db, comparison_dataset_id)
        if not comp_ds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comparison dataset '{comparison_dataset_id}' not found.",
            )

        # 2. Check cross-project prevention
        if (
            base_ds.project_id
            and comp_ds.project_id
            and base_ds.project_id != comp_ds.project_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cross-project dataset comparison is not permitted. Both dataset versions must belong to the same project.",
            )

        # 2b. Check cross-lineage comparison prevention
        base_lineage = cls.get_logical_lineage_name(db, base_ds)
        comp_lineage = cls.get_logical_lineage_name(db, comp_ds)
        if base_lineage.strip().lower() != comp_lineage.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cross-lineage dataset comparison is not permitted. Cannot compare '{base_lineage}' (v{base_ds.version}) with '{comp_lineage}' (v{comp_ds.version}). Both versions must belong to the same dataset lineage.",
            )

        # 3. Load DataFrames
        try:
            df_base = DatasetService.load_dataset_dataframe(base_ds)
        except Exception as err:
            logger.warning(f"Could not load DataFrame for base dataset {base_ds.id}: {err}")
            df_base = pd.DataFrame()

        try:
            df_comp = DatasetService.load_dataset_dataframe(comp_ds)
        except Exception as err:
            logger.warning(f"Could not load DataFrame for comparison dataset {comp_ds.id}: {err}")
            df_comp = pd.DataFrame()

        # 4. Basic dimensions & summary
        rows_base = len(df_base)
        rows_comp = len(df_comp)
        rows_change = rows_comp - rows_base
        rows_change_pct = (
            round(((rows_comp - rows_base) / rows_base) * 100.0, 2)
            if rows_base > 0
            else (0.0 if rows_comp == 0 else 100.0)
        )

        cols_base = [str(c) for c in df_base.columns]
        cols_comp = [str(c) for c in df_comp.columns]
        added_cols = [c for c in cols_comp if c not in cols_base]
        removed_cols = [c for c in cols_base if c not in cols_comp]
        common_cols = [c for c in cols_base if c in cols_comp]

        # 5. Schema changes
        schema_changes: List[SchemaChange] = []
        for c in added_cols:
            schema_changes.append(
                SchemaChange(
                    column=c,
                    change_type="added",
                    base_type=None,
                    comparison_type=str(df_comp[c].dtype),
                )
            )
        for c in removed_cols:
            schema_changes.append(
                SchemaChange(
                    column=c,
                    change_type="removed",
                    base_type=str(df_base[c].dtype),
                    comparison_type=None,
                )
            )
        for c in common_cols:
            b_type = str(df_base[c].dtype)
            c_type = str(df_comp[c].dtype)
            change_type = "type_changed" if b_type != c_type else "unchanged"
            schema_changes.append(
                SchemaChange(
                    column=c,
                    change_type=change_type,
                    base_type=b_type,
                    comparison_type=c_type,
                )
            )

        # 6. Quality Delta
        try:
            qual_base = QualityService.evaluate_quality(df_base, base_ds.id)
            qual_score_base = float(qual_base.score.overall_score)
            missing_cells_base = int(qual_base.completeness.total_missing_cells)
            dup_base = int(qual_base.uniqueness.duplicate_rows)
            miss_pct_base = float(qual_base.completeness.missing_percentage)
            dup_pct_base = float(qual_base.uniqueness.duplicate_row_percentage)
        except Exception:
            qual_score_base = None
            missing_cells_base = 0
            dup_base = 0
            miss_pct_base = 0.0
            dup_pct_base = 0.0

        try:
            qual_comp = QualityService.evaluate_quality(df_comp, comp_ds.id)
            qual_score_comp = float(qual_comp.score.overall_score)
            missing_cells_comp = int(qual_comp.completeness.total_missing_cells)
            dup_comp = int(qual_comp.uniqueness.duplicate_rows)
            miss_pct_comp = float(qual_comp.completeness.missing_percentage)
            dup_pct_comp = float(qual_comp.uniqueness.duplicate_row_percentage)
        except Exception:
            qual_score_comp = None
            missing_cells_comp = 0
            dup_comp = 0
            miss_pct_comp = 0.0
            dup_pct_comp = 0.0

        qual_change = (
            round(qual_score_comp - qual_score_base, 1)
            if qual_score_base is not None and qual_score_comp is not None
            else None
        )
        if qual_change is not None:
            if qual_change > 0.5:
                qual_status = "improved"
            elif qual_change < -0.5:
                qual_status = "degraded"
            else:
                qual_status = "stable"
        else:
            qual_status = "stable"

        quality_changes = QualityChangeDetail(
            previous_score=qual_score_base,
            current_score=qual_score_comp,
            delta=qual_change,
            status=qual_status,
            missing_percentage_delta=round(miss_pct_comp - miss_pct_base, 2),
            duplicate_percentage_delta=round(dup_pct_comp - dup_pct_base, 2),
        )

        # 7. Metric Changes for common numeric columns
        metric_changes: List[MetricChange] = []
        significant_changes: List[str] = []

        # Document high-level structural significant changes
        if abs(rows_change) > 0:
            direction = "expanded" if rows_change > 0 else "contracted"
            significant_changes.append(
                f"Row count {direction} from {rows_base:,} to {rows_comp:,} ({rows_change_pct:+.1f}%)"
            )
        if added_cols:
            significant_changes.append(f"{len(added_cols)} new column(s) added: {', '.join(added_cols[:3])}{'...' if len(added_cols) > 3 else ''}")
        if removed_cols:
            significant_changes.append(f"{len(removed_cols)} column(s) removed: {', '.join(removed_cols[:3])}{'...' if len(removed_cols) > 3 else ''}")
        if qual_change is not None and abs(qual_change) >= 2.0:
            verb = "improved" if qual_change > 0 else "declined"
            significant_changes.append(f"Data quality {verb} by {abs(qual_change):.1f} pts ({qual_score_base:.0f}% → {qual_score_comp:.0f}%)")

        distribution_changes: List[DistributionChange] = []

        for col in common_cols:
            series_b = df_base[col].dropna()
            series_c = df_comp[col].dropna()

            is_numeric_b = pd.api.types.is_numeric_dtype(df_base[col])
            is_numeric_c = pd.api.types.is_numeric_dtype(df_comp[col])

            if is_numeric_b and is_numeric_c and len(series_b) > 0 and len(series_c) > 0:
                m_b = float(series_b.mean())
                m_c = float(series_c.mean())
                med_b = float(series_b.median())
                med_c = float(series_c.median())
                s_b = float(series_b.std()) if len(series_b) > 1 else 0.0
                s_c = float(series_c.std()) if len(series_c) > 1 else 0.0
                min_b = float(series_b.min())
                min_c = float(series_c.min())
                max_b = float(series_b.max())
                max_c = float(series_c.max())

                mean_pct = (
                    round(((m_c - m_b) / abs(m_b)) * 100.0, 2)
                    if m_b != 0
                    else (0.0 if m_c == 0 else 100.0)
                )
                med_pct = (
                    round(((med_c - med_b) / abs(med_b)) * 100.0, 2)
                    if med_b != 0
                    else (0.0 if med_c == 0 else 100.0)
                )

                # Significance logic
                is_sig = False
                sig_reasons = []
                if abs(mean_pct) >= 7.5:
                    is_sig = True
                    sig_reasons.append(f"Mean shifted by {mean_pct:+.1f}%")
                if s_b > 0 and abs((s_c - s_b) / s_b) >= 0.25:
                    is_sig = True
                    sig_reasons.append("Variance changed materially")

                sig_reason_str = "; ".join(sig_reasons) if sig_reasons else None
                if is_sig:
                    significant_changes.append(f"Metric '{col}' mean shifted {mean_pct:+.1f}% ({round(m_b, 2)} → {round(m_c, 2)})")

                metric_changes.append(
                    MetricChange(
                        column=col,
                        base_mean=round(m_b, 2),
                        comparison_mean=round(m_c, 2),
                        mean_change_pct=mean_pct,
                        base_median=round(med_b, 2),
                        comparison_median=round(med_c, 2),
                        median_change_pct=med_pct,
                        base_std=round(s_b, 2),
                        comparison_std=round(s_c, 2),
                        base_min=round(min_b, 2),
                        comparison_min=round(min_c, 2),
                        base_max=round(max_b, 2),
                        comparison_max=round(max_c, 2),
                        is_significant=is_sig,
                        significance_reason=sig_reason_str,
                    )
                )

                # Check IQR for numeric distribution
                q25_b, q75_b = float(series_b.quantile(0.25)), float(series_b.quantile(0.75))
                q25_c, q75_c = float(series_c.quantile(0.25)), float(series_c.quantile(0.75))
                iqr_b = q75_b - q25_b
                iqr_c = q75_c - q25_c
                if iqr_b > 0 and abs((iqr_c - iqr_b) / iqr_b) >= 0.3:
                    distribution_changes.append(
                        DistributionChange(
                            column=col,
                            column_type="numeric",
                            shift_description=f"Interquartile spread shifted from {round(iqr_b, 2)} to {round(iqr_c, 2)}",
                            is_significant=True,
                        )
                    )
                elif is_sig:
                    distribution_changes.append(
                        DistributionChange(
                            column=col,
                            column_type="numeric",
                            shift_description=f"Distribution mean shifted by {mean_pct:+.1f}%",
                            is_significant=True,
                        )
                    )

            elif not is_numeric_b and not is_numeric_c:
                # Categorical column comparison
                cats_b = set(series_b.astype(str).unique())
                cats_c = set(series_c.astype(str).unique())
                new_cats = sorted(list(cats_c - cats_b))
                disp_cats = sorted(list(cats_b - cats_c))

                if new_cats or disp_cats:
                    desc_parts = []
                    if new_cats:
                        desc_parts.append(f"+{len(new_cats)} new categories ({', '.join(new_cats[:2])})")
                    if disp_cats:
                        desc_parts.append(f"-{len(disp_cats)} discontinued ({', '.join(disp_cats[:2])})")
                    desc = "; ".join(desc_parts)

                    distribution_changes.append(
                        DistributionChange(
                            column=col,
                            column_type="categorical",
                            new_categories=new_cats[:10],
                            disappeared_categories=disp_cats[:10],
                            shift_description=desc,
                            is_significant=len(new_cats) > 0 or len(disp_cats) > 0,
                        )
                    )
                    if len(new_cats) > 0 or len(disp_cats) > 0:
                        significant_changes.append(f"Categorical column '{col}': {desc}")

        if not significant_changes:
            significant_changes.append("No significant structural or statistical drift detected between these versions.")

        # 8. Impact on Insights (Phase 2H)
        insight_impacts: List[InsightImpact] = []
        # Find insights associated with base dataset or its parent
        dataset_ids_to_check = [base_ds.id]
        if base_ds.parent_id:
            dataset_ids_to_check.append(base_ds.parent_id)
        # Also include child processed datasets of base_ds
        child_ids = list(db.scalars(select(Dataset.id).where(Dataset.parent_id == base_ds.id)).all())
        dataset_ids_to_check.extend(child_ids)

        existing_insights = list(
            db.scalars(
                select(DatasetInsight).where(DatasetInsight.dataset_id.in_(dataset_ids_to_check))
            ).all()
        )

        for ins in existing_insights:
            src_col = ins.source_column
            if src_col and src_col in removed_cols:
                status_val = "NO LONGER OBSERVED"
                expl = f"Supporting column '{src_col}' was removed in comparison version."
            elif rows_comp == 0:
                status_val = "INSUFFICIENT DATA"
                expl = "Comparison dataset contains zero records."
            elif src_col and src_col in [m.column for m in metric_changes if m.is_significant]:
                status_val = "CHANGED"
                matching_m = next((m for m in metric_changes if m.column == src_col), None)
                shift = f"{matching_m.mean_change_pct:+.1f}%" if matching_m and matching_m.mean_change_pct else "material shift"
                expl = f"Underlying metric '{src_col}' shifted by {shift} in comparison version."
            else:
                status_val = "SUPPORTED"
                expl = "Supporting distribution and underlying metrics remain consistent."

            insight_impacts.append(
                InsightImpact(
                    insight_id=ins.id,
                    title=ins.title,
                    category=ins.category,
                    severity=ins.severity,
                    status=status_val,
                    explanation=expl,
                )
            )

        # 9. Impact on Predictions / Models (Phase 2I)
        ml_models = list(
            db.scalars(
                select(MLAnalysis).where(MLAnalysis.dataset_id.in_(dataset_ids_to_check))
            ).all()
        )

        if not ml_models:
            pred_impact = PredictionImpact(
                total_models=0,
                schema_status="NO MODELS TRAINED",
                refresh_recommended=False,
                affected_features=[],
                missing_targets=[],
                details="No machine learning models have been trained on the base dataset version yet.",
            )
        else:
            missing_features: Set[str] = set()
            missing_targets: Set[str] = set()
            for m in ml_models:
                feat_cols = m.feature_columns if isinstance(m.feature_columns, list) else []
                for f in feat_cols:
                    if f in removed_cols:
                        missing_features.add(f)
                if m.target_column and m.target_column in removed_cols:
                    missing_targets.add(m.target_column)

            if missing_features or missing_targets:
                schema_st = "MODEL INPUT SCHEMA CHANGED"
                refresh_rec = True
                details_msg = (
                    f"Model input schema broken: features {list(missing_features)} or targets {list(missing_targets)} "
                    "are missing from the comparison dataset."
                )
            elif abs(rows_change_pct) >= 15.0 or any(m.is_significant for m in metric_changes):
                schema_st = "SCHEMA UNCHANGED"
                refresh_rec = True
                details_msg = (
                    "Input schema is intact, but significant distributional shift detected. "
                    "Model recalibration/refresh is recommended to prevent predictive drift."
                )
            else:
                schema_st = "SCHEMA UNCHANGED"
                refresh_rec = False
                details_msg = "Model input features and distributions are stable. Existing trained models remain valid."

            pred_impact = PredictionImpact(
                total_models=len(ml_models),
                schema_status=schema_st,
                refresh_recommended=refresh_rec,
                affected_features=sorted(list(missing_features)),
                missing_targets=sorted(list(missing_targets)),
                details=details_msg,
            )

        # 10. Assemble Summary
        summary = ComparisonSummary(
            base_dataset_id=base_ds.id,
            base_version=base_ds.version or 1,
            base_name=base_ds.name,
            comparison_dataset_id=comp_ds.id,
            comparison_version=comp_ds.version or 1,
            comparison_name=comp_ds.name,
            rows_base=rows_base,
            rows_comparison=rows_comp,
            rows_change=rows_change,
            rows_change_pct=rows_change_pct,
            columns_base=len(cols_base),
            columns_comparison=len(cols_comp),
            columns_added_count=len(added_cols),
            columns_removed_count=len(removed_cols),
            quality_base=qual_score_base,
            quality_comparison=qual_score_comp,
            quality_change=qual_change,
            missing_cells_base=missing_cells_base,
            missing_cells_comparison=missing_cells_comp,
            missing_cells_change=missing_cells_comp - missing_cells_base,
            duplicate_rows_base=dup_base,
            duplicate_rows_comparison=dup_comp,
            duplicate_rows_change=dup_comp - dup_base,
        )

        return DatasetComparisonResponse(
            base_dataset_id=base_ds.id,
            comparison_dataset_id=comp_ds.id,
            summary=summary,
            schema_changes=schema_changes,
            quality_changes=quality_changes,
            metric_changes=metric_changes,
            distribution_changes=distribution_changes,
            significant_changes=significant_changes,
            insight_impacts=insight_impacts,
            prediction_impact=pred_impact,
        )
