import io
import uuid
from typing import List, Tuple, Dict, Any
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.logging import logger
from app.models.dataset import Dataset
from app.models.transformation_log import TransformationLog
from app.schemas.cleaning import (
    CleaningPlan,
    CleaningOperation,
    CleaningPreviewResponse,
    CleaningApplyResponse,
    ProposedChangeDetail,
    PreviewMetrics,
)
from app.services.quality_service import QualityService
from app.services.type_detector import TypeDetector
from app.services.profiling_service import ProfilingService
from app.services.storage_service import storage_service


class CleaningService:
    """Deterministic data cleaning, preview, and transformation execution engine."""

    @classmethod
    def validate_plan(cls, df: pd.DataFrame, plan: CleaningPlan) -> None:
        """Validate that cleaning operations in plan are supported and compatible with dataframe columns."""
        if not plan.operations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cleaning plan contains no operations."
            )

        supported_types = {
            "remove_duplicates",
            "fill_missing",
            "remove_empty_columns",
            "remove_constant_columns",
            "trim_whitespace",
            "convert_case",
            "convert_type",
        }

        for idx, op in enumerate(plan.operations):
            if op.type not in supported_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Operation [{idx}] type '{op.type}' is not supported."
                )

            # Validate column existence if column is specified
            if op.column:
                if op.column not in df.columns:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] specifies non-existent column '{op.column}'."
                    )
                inferred = TypeDetector.detect_column_type(df[op.column], op.column)
            else:
                inferred = None

            # Operation specific validation
            if op.type == "fill_missing":
                valid_strategies = {"drop_rows", "mean", "median", "mode", "constant"}
                if not op.strategy or op.strategy not in valid_strategies:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] fill_missing requires strategy in {valid_strategies}."
                    )

                if not op.column:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] fill_missing requires a target column."
                    )

                # Compatibility checks
                if op.strategy in ("mean", "median"):
                    if inferred != "numeric":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Strategy '{op.strategy}' is incompatible with non-numeric column '{op.column}' (inferred type: '{inferred}')."
                        )
                elif op.strategy == "constant":
                    if op.fill_value is None:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Operation [{idx}] fill_missing strategy 'constant' requires fill_value."
                        )

            elif op.type == "convert_case":
                if not op.column:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] convert_case requires a target column."
                    )
                if inferred in ("numeric", "datetime"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Case conversion is incompatible with {inferred} column '{op.column}'."
                    )
                if not op.strategy or op.strategy not in ("lowercase", "uppercase"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] convert_case strategy must be 'lowercase' or 'uppercase'."
                    )

            elif op.type == "convert_type":
                if not op.column:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] convert_type requires a target column."
                    )
                if not op.target_type or op.target_type not in ("numeric", "datetime"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Operation [{idx}] convert_type target_type must be 'numeric' or 'datetime'."
                    )

    @classmethod
    def apply_operations(
        cls, df: pd.DataFrame, operations: List[CleaningOperation]
    ) -> Tuple[pd.DataFrame, List[ProposedChangeDetail], List[Dict[str, Any]]]:
        """Apply a sequence of cleaning operations to an in-memory DataFrame copy."""
        df_clean = df.copy()
        proposed_changes: List[ProposedChangeDetail] = []
        log_entries: List[Dict[str, Any]] = []

        for op in operations:
            if op.type == "remove_duplicates":
                before_rows = len(df_clean)
                df_clean = df_clean.drop_duplicates()
                affected = before_rows - len(df_clean)
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="remove_duplicates",
                    affected_rows=affected,
                    description=f"Removed {affected} duplicate rows.",
                ))
                log_entries.append({
                    "operation_type": "remove_duplicates",
                    "column_name": None,
                    "strategy": None,
                    "affected_rows": affected,
                    "details": {"before_rows": before_rows, "after_rows": len(df_clean)},
                })

            elif op.type == "fill_missing":
                col = op.column
                strat = op.strategy
                null_cnt = int(df_clean[col].isna().sum())

                if strat == "drop_rows":
                    before_rows = len(df_clean)
                    df_clean = df_clean.dropna(subset=[col])
                    affected = before_rows - len(df_clean)
                    desc = f"Dropped {affected} rows containing missing values in '{col}'."
                elif strat == "mean":
                    val = float(df_clean[col].mean())
                    df_clean[col] = df_clean[col].fillna(val)
                    affected = null_cnt
                    desc = f"Filled {affected} missing values in '{col}' with mean ({round(val, 4)})."
                elif strat == "median":
                    val = float(df_clean[col].median())
                    df_clean[col] = df_clean[col].fillna(val)
                    affected = null_cnt
                    desc = f"Filled {affected} missing values in '{col}' with median ({round(val, 4)})."
                elif strat == "mode":
                    modes = df_clean[col].mode()
                    val = modes.iloc[0] if not modes.empty else "N/A"
                    df_clean[col] = df_clean[col].fillna(val)
                    affected = null_cnt
                    desc = f"Filled {affected} missing values in '{col}' with mode ('{val}')."
                elif strat == "constant":
                    val = op.fill_value
                    df_clean[col] = df_clean[col].fillna(val)
                    affected = null_cnt
                    desc = f"Filled {affected} missing values in '{col}' with constant ('{val}')."

                proposed_changes.append(ProposedChangeDetail(
                    operation_type="fill_missing",
                    column=col,
                    strategy=strat,
                    affected_rows=affected,
                    description=desc,
                ))
                log_entries.append({
                    "operation_type": "fill_missing",
                    "column_name": col,
                    "strategy": strat,
                    "affected_rows": affected,
                    "details": {"fill_value": str(op.fill_value) if op.fill_value is not None else None},
                })

            elif op.type == "remove_empty_columns":
                empty_cols = [str(c) for c in df_clean.columns if df_clean[c].isna().all()]
                if empty_cols:
                    df_clean = df_clean.drop(columns=empty_cols)
                affected = len(empty_cols)
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="remove_empty_columns",
                    affected_rows=affected,
                    description=f"Removed {affected} empty columns ({', '.join(empty_cols) if empty_cols else 'none'}).",
                ))
                log_entries.append({
                    "operation_type": "remove_empty_columns",
                    "column_name": None,
                    "strategy": None,
                    "affected_rows": affected,
                    "details": {"removed_columns": empty_cols},
                })

            elif op.type == "remove_constant_columns":
                const_cols = [
                    str(c) for c in df_clean.columns 
                    if df_clean[c].dropna().nunique() == 1 and df_clean[c].dropna().count() > 0
                ]
                if const_cols:
                    df_clean = df_clean.drop(columns=const_cols)
                affected = len(const_cols)
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="remove_constant_columns",
                    affected_rows=affected,
                    description=f"Removed {affected} constant single-value columns ({', '.join(const_cols) if const_cols else 'none'}).",
                ))
                log_entries.append({
                    "operation_type": "remove_constant_columns",
                    "column_name": None,
                    "strategy": None,
                    "affected_rows": affected,
                    "details": {"removed_columns": const_cols},
                })

            elif op.type == "trim_whitespace":
                cols_to_trim = [op.column] if op.column else list(df_clean.columns)
                affected_cnt = 0
                for c in cols_to_trim:
                    if c in df_clean.columns:
                        s_str = df_clean[c].astype(str)
                        trimmed = s_str.str.strip()
                        diff_cnt = int((s_str != trimmed).sum())
                        affected_cnt += diff_cnt
                        df_clean[c] = trimmed
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="trim_whitespace",
                    column=op.column,
                    affected_rows=affected_cnt,
                    description=f"Trimmed leading/trailing whitespace across {affected_cnt} values.",
                ))
                log_entries.append({
                    "operation_type": "trim_whitespace",
                    "column_name": op.column,
                    "strategy": None,
                    "affected_rows": affected_cnt,
                    "details": {"trimmed_values_count": affected_cnt},
                })

            elif op.type == "convert_case":
                col = op.column
                strat = op.strategy
                s_str = df_clean[col].astype(str)
                if strat == "lowercase":
                    converted = s_str.str.lower()
                else:
                    converted = s_str.str.upper()
                affected = int((s_str != converted).sum())
                df_clean[col] = converted
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="convert_case",
                    column=col,
                    strategy=strat,
                    affected_rows=affected,
                    description=f"Converted {affected} text values in '{col}' to {strat}.",
                ))
                log_entries.append({
                    "operation_type": "convert_case",
                    "column_name": col,
                    "strategy": strat,
                    "affected_rows": affected,
                    "details": {},
                })

            elif op.type == "convert_type":
                col = op.column
                tgt = op.target_type
                if tgt == "numeric":
                    df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
                elif tgt == "datetime":
                    df_clean[col] = pd.to_datetime(df_clean[col], errors='coerce')
                proposed_changes.append(ProposedChangeDetail(
                    operation_type="convert_type",
                    column=col,
                    strategy=tgt,
                    affected_rows=len(df_clean),
                    description=f"Converted column '{col}' data type to {tgt}.",
                ))
                log_entries.append({
                    "operation_type": "convert_type",
                    "column_name": col,
                    "strategy": tgt,
                    "affected_rows": len(df_clean),
                    "details": {"target_type": tgt},
                })

        return df_clean, proposed_changes, log_entries

    @classmethod
    def preview_cleaning(
        cls, df: pd.DataFrame, dataset_id: str, plan: CleaningPlan
    ) -> CleaningPreviewResponse:
        """Preview impact of cleaning plan strictly in-memory without modifying raw dataset."""
        cls.validate_plan(df, plan)

        # Before quality analysis
        before_res = QualityService.evaluate_quality(df, dataset_id)
        before_metrics = PreviewMetrics(
            total_rows=len(df),
            total_columns=len(df.columns),
            total_missing_cells=before_res.completeness.total_missing_cells,
            duplicate_rows=before_res.uniqueness.duplicate_rows,
            quality_score=before_res.score.overall_score,
            severity=before_res.score.severity,
        )

        # Apply operations to in-memory copy
        df_cleaned, proposed_changes, _ = cls.apply_operations(df, plan.operations)

        # Expected after quality analysis
        after_res = QualityService.evaluate_quality(df_cleaned, dataset_id)
        after_metrics = PreviewMetrics(
            total_rows=len(df_cleaned),
            total_columns=len(df_cleaned.columns),
            total_missing_cells=after_res.completeness.total_missing_cells,
            duplicate_rows=after_res.uniqueness.duplicate_rows,
            quality_score=after_res.score.overall_score,
            severity=after_res.score.severity,
        )

        return CleaningPreviewResponse(
            dataset_id=dataset_id,
            proposed_changes=proposed_changes,
            before=before_metrics,
            expected_after=after_metrics,
        )

    @classmethod
    def apply_cleaning(
        cls, db: Session, raw_dataset: Dataset, raw_df: pd.DataFrame, plan: CleaningPlan
    ) -> CleaningApplyResponse:
        """Apply cleaning plan, save processed CSV into data/processed/, record audit logs, and re-profile."""
        cls.validate_plan(raw_df, plan)

        # Before quality metrics
        before_res = QualityService.evaluate_quality(raw_df, raw_dataset.id)
        before_metrics = PreviewMetrics(
            total_rows=len(raw_df),
            total_columns=len(raw_df.columns),
            total_missing_cells=before_res.completeness.total_missing_cells,
            duplicate_rows=before_res.uniqueness.duplicate_rows,
            quality_score=before_res.score.overall_score,
            severity=before_res.score.severity,
        )

        # Execute operations on in-memory DataFrame
        df_cleaned, _, log_entries = cls.apply_operations(raw_df, plan.operations)

        # Convert processed DataFrame to CSV bytes
        csv_buffer = io.StringIO()
        df_cleaned.to_csv(csv_buffer, index=False)
        processed_bytes = csv_buffer.getvalue().encode("utf-8")

        # Save processed CSV via StorageService abstraction into data/processed/<uuid>.csv
        proc_filename = f"cleaned_{raw_dataset.name}"
        storage_key, sanitized_name, file_size = storage_service.save_processed_file(
            processed_bytes, proc_filename
        )

        output_dataset_id = str(uuid.uuid4())
        total_rows = len(df_cleaned)
        total_cols = len(df_cleaned.columns)

        # Profile processed dataset
        profile = ProfilingService.profile_dataframe(
            df=df_cleaned,
            dataset_id=output_dataset_id,
            filename=sanitized_name,
            file_size_bytes=file_size,
        )

        # Create processed Dataset DB record
        processed_dataset = Dataset(
            id=output_dataset_id,
            name=sanitized_name,
            description=f"Cleaned dataset version derived from {raw_dataset.name}",
            file_path=storage_key,
            file_size_bytes=file_size,
            row_count=total_rows,
            column_count=total_cols,
            mime_type="text/csv",
            status="processed",
            profile_data=profile.model_dump(),
            parent_id=raw_dataset.id,
            is_processed=True,
        )
        db.add(processed_dataset)

        # Record TransformationLog entries in DB
        db_logs: List[TransformationLog] = []
        for log in log_entries:
            t_log = TransformationLog(
                dataset_id=raw_dataset.id,
                output_dataset_id=output_dataset_id,
                operation_type=log["operation_type"],
                column_name=log.get("column_name"),
                strategy=log.get("strategy"),
                affected_rows=log.get("affected_rows", 0),
                details=log.get("details"),
            )
            db.add(t_log)
            db_logs.append(t_log)

        db.commit()
        db.refresh(processed_dataset)

        # After quality metrics
        after_res = QualityService.evaluate_quality(df_cleaned, output_dataset_id)
        after_metrics = PreviewMetrics(
            total_rows=total_rows,
            total_columns=total_cols,
            total_missing_cells=after_res.completeness.total_missing_cells,
            duplicate_rows=after_res.uniqueness.duplicate_rows,
            quality_score=after_res.score.overall_score,
            severity=after_res.score.severity,
        )

        saved_logs_json = [
            {
                "id": l.id,
                "operation_type": l.operation_type,
                "column_name": l.column_name,
                "strategy": l.strategy,
                "affected_rows": l.affected_rows,
                "details": l.details,
                "created_at": str(l.created_at),
            }
            for l in db_logs
        ]

        logger.info(f"Applied cleaning plan to raw dataset '{raw_dataset.id}'. Saved processed dataset '{output_dataset_id}' ({total_rows} rows, {total_cols} cols).")

        return CleaningApplyResponse(
            original_dataset_id=raw_dataset.id,
            output_dataset_id=output_dataset_id,
            processed_filename=sanitized_name,
            storage_key=storage_key,
            transformation_logs_count=len(db_logs),
            before=before_metrics,
            after=after_metrics,
            transformation_logs=saved_logs_json,
        )
