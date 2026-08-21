import math
from typing import Any
import pandas as pd
import numpy as np
from app.services.type_detector import TypeDetector
from app.schemas.profile import (
    NumericStats,
    CategoricalValueCount,
    CategoricalStats,
    DatetimeStats,
    ColumnProfile,
    QualitySummary,
    DatasetOverview,
    DatasetProfileResponse,
)


def sanitize_val(val: Any) -> Any:
    """Convert numpy / pandas types and NaN values to JSON-serializable Python primitives."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return None if (math.isnan(val) or math.isinf(val)) else float(val)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (pd.Timestamp, np.datetime64)):
        return str(val)
    return str(val)


class ProfilingService:
    """Pandas-based automated dataset profiling engine."""

    @classmethod
    def profile_dataframe(
        cls,
        df: pd.DataFrame,
        dataset_id: str,
        filename: str,
        file_size_bytes: int = 0,
    ) -> DatasetProfileResponse:
        total_rows = len(df)
        total_columns = len(df.columns)
        memory_usage = int(df.memory_usage(deep=True).sum()) if total_rows > 0 else 0

        # Duplicate row check
        duplicate_rows = int(df.duplicated().sum()) if total_rows > 0 else 0
        duplicate_pct = round((duplicate_rows / total_rows * 100.0), 2) if total_rows > 0 else 0.0

        empty_columns: list[str] = []
        constant_columns: list[str] = []
        column_profiles: list[ColumnProfile] = []

        for col in df.columns:
            col_name = str(col)
            series = df[col]
            clean_series = series.dropna()
            non_null_count = len(clean_series)
            null_count = total_rows - non_null_count
            null_pct = round((null_count / total_rows * 100.0), 2) if total_rows > 0 else 0.0

            unique_count = int(series.nunique(dropna=True))
            unique_pct = round((unique_count / total_rows * 100.0), 2) if total_rows > 0 else 0.0

            if non_null_count == 0:
                empty_columns.append(col_name)

            if unique_count == 1 and non_null_count > 0:
                constant_columns.append(col_name)

            # Detect column data type
            inferred_type = TypeDetector.detect_column_type(series, col_name)

            # Extract clean sample values (up to 5)
            raw_samples = clean_series.unique()[:5]
            sample_values = [sanitize_val(v) for v in raw_samples if sanitize_val(v) is not None]

            numeric_stats = None
            categorical_stats = None
            datetime_stats = None

            if inferred_type == 'numeric':
                num_series = pd.to_numeric(clean_series, errors='coerce').dropna()
                if len(num_series) > 0:
                    numeric_stats = NumericStats(
                        min=sanitize_val(num_series.min()),
                        max=sanitize_val(num_series.max()),
                        mean=round(float(num_series.mean()), 4),
                        median=round(float(num_series.median()), 4),
                        std=round(float(num_series.std()), 4) if len(num_series) > 1 else 0.0,
                        p25=round(float(num_series.quantile(0.25)), 4),
                        p50=round(float(num_series.quantile(0.50)), 4),
                        p75=round(float(num_series.quantile(0.75)), 4),
                    )

            elif inferred_type in ('categorical', 'boolean', 'identifier', 'text'):
                str_series = clean_series.astype(str)
                val_counts = str_series.value_counts().head(10)
                top_values = []
                for val, count in val_counts.items():
                    val_str = str(val)
                    pct = round((int(count) / total_rows * 100.0), 2) if total_rows > 0 else 0.0
                    top_values.append(CategoricalValueCount(
                        value=val_str,
                        count=int(count),
                        percentage=pct
                    ))
                categorical_stats = CategoricalStats(
                    top_values=top_values,
                    unique_count=unique_count
                )

            elif inferred_type == 'datetime':
                dt_series = pd.to_datetime(clean_series, errors='coerce').dropna()
                if len(dt_series) > 0:
                    min_dt = dt_series.min()
                    max_dt = dt_series.max()
                    date_range_days = round(float((max_dt - min_dt).total_seconds() / 86400.0), 2)
                    datetime_stats = DatetimeStats(
                        min_date=str(min_dt),
                        max_date=str(max_dt),
                        date_range_days=date_range_days
                    )

            column_profiles.append(ColumnProfile(
                name=col_name,
                inferred_type=inferred_type,
                null_count=null_count,
                null_percentage=null_pct,
                unique_count=unique_count,
                unique_percentage=unique_pct,
                sample_values=sample_values,
                numeric_stats=numeric_stats,
                categorical_stats=categorical_stats,
                datetime_stats=datetime_stats,
            ))

        overview = DatasetOverview(
            filename=filename,
            total_rows=total_rows,
            total_columns=total_columns,
            file_size_bytes=file_size_bytes,
            memory_usage_bytes=memory_usage,
            duplicate_rows=duplicate_rows,
            duplicate_row_percentage=duplicate_pct,
            empty_column_count=len(empty_columns),
            constant_column_count=len(constant_columns),
        )

        quality = QualitySummary(
            duplicate_row_count=duplicate_rows,
            duplicate_row_percentage=duplicate_pct,
            empty_columns=empty_columns,
            constant_columns=constant_columns,
        )

        return DatasetProfileResponse(
            dataset_id=dataset_id,
            overview=overview,
            columns=column_profiles,
            quality=quality,
        )
