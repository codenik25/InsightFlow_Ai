from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from app.schemas.kpi import ColumnRoleInfo, KPIMetric, DatasetOverviewKPIs
from app.schemas.eda import CategoryBreakdown, GroupedCategoryValue


class KPIService:
    """Deterministic, domain-agnostic Key Performance Indicator & Metric Suitability Engine."""

    @classmethod
    def format_title(cls, col_name: str) -> str:
        """Convert snake_case or camelCase column names into title case."""
        clean = col_name.replace("_", " ").replace("-", " ")
        return clean.title()

    @classmethod
    def classify_measure_nature(cls, col_name: str, series: pd.Series) -> str:
        """
        Deterministically classifies a numeric measure column into one of 3 analytical natures:
        - 'price_rate': Unit price, rate, unit cost, ratio, score, percentage (SUM is misleading and excluded).
        - 'quantity_count': Count, quantity, volume, items, clicks, impressions (SUM represents total volume).
        - 'amount_value': Revenue, total amount, spend, salary, profit, value (SUM represents aggregate value).
        """
        col_lower = col_name.lower().replace("-", "_")

        # 1. Explicit price/rate signals (unit price, rate, cost per unit, ratio, score, etc.)
        if any(kw in col_lower for kw in ["unit_price", "unit_cost", "rate", "fee_per_unit", "cost_per_unit", "ratio", "margin", "pct", "percent", "percentage", "score", "rating", "cpr", "cpc", "cpm"]):
            return "price_rate"

        # Check if 'price' or 'cost' appears without 'total' or 'amount'
        if ("price" in col_lower or "cost" in col_lower) and not any(kw in col_lower for kw in ["total", "amount", "spend", "sum", "aggregate"]):
            return "price_rate"

        # 2. Explicit count/quantity signals
        if any(kw in col_lower for kw in ["units", "quantity", "qty", "count", "items", "clicks", "impressions", "conversions", "downloads", "views", "sessions"]):
            return "quantity_count"

        # 3. Explicit amount/value signals
        if any(kw in col_lower for kw in ["revenue", "sales", "salary", "spend", "budget", "amount", "profit", "loss", "income", "value", "val"]):
            return "amount_value"

        # 4. Fallback based on data type
        is_int = pd.api.types.is_integer_dtype(series.dtype)
        if is_int:
            return "quantity_count"

        return "amount_value"

    @classmethod
    def infer_format(cls, col_name: str, is_int: bool = False) -> str:
        """
        Returns neutral numeric formatting unless explicit metadata is provided.
        Does NOT assume USD or any currency symbol.
        """
        if is_int:
            return "integer"
        return "number"

    @classmethod
    def compute_dataset_overview_kpis(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> DatasetOverviewKPIs:
        total_rows = len(df)
        total_columns = len(df.columns)
        total_missing = int(df.isna().sum().sum())
        duplicate_rows = int(df.duplicated().sum())

        role_counts: Dict[str, int] = {}
        for r in roles:
            role_counts[r.role] = role_counts.get(r.role, 0) + 1

        return DatasetOverviewKPIs(
            total_rows=total_rows,
            total_columns=total_columns,
            measure_count=role_counts.get("measure", 0),
            dimension_count=role_counts.get("categorical_dimension", 0),
            datetime_count=role_counts.get("datetime_dimension", 0),
            total_missing_cells=total_missing,
            duplicate_rows=duplicate_rows,
        )

    @classmethod
    def discover_measure_kpis(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> List[KPIMetric]:
        kpis: List[KPIMetric] = []
        measure_roles = [r for r in roles if r.role == "measure"]

        for r in measure_roles:
            col = r.column
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(series) == 0:
                continue

            raw_title = cls.format_title(col)
            # Remove duplicate "Total " prefix if column is already named e.g. "total_revenue"
            if raw_title.lower().startswith("total "):
                base_title = raw_title[6:].strip()
                sum_title = raw_title
            else:
                base_title = raw_title
                sum_title = f"Total {raw_title}"

            is_int = pd.api.types.is_integer_dtype(series.dtype)
            fmt = cls.infer_format(col, is_int=is_int)
            nature = cls.classify_measure_nature(col, series)

            mean_val = float(series.mean())
            median_val = float(series.median())
            min_val = float(series.min())
            max_val = float(series.max())
            std_val = float(series.std()) if len(series) > 1 else 0.0

            # 1. Total/Sum KPI: Generated ONLY for quantity_count and amount_value
            if nature in ("quantity_count", "amount_value"):
                total_val = float(series.sum())
                reason_str = (
                    f"Count/quantity-like measure; total sum represents total volume."
                    if nature == "quantity_count"
                    else f"Amount/value-like measure; total sum represents aggregate value."
                )
                kpis.append(
                    KPIMetric(
                        name=sum_title,
                        value=int(round(total_val)) if fmt == "integer" else round(total_val, 2),
                        metric_type="sum",
                        source_column=col,
                        format=fmt,
                        reason=reason_str,
                    )
                )

            # 2. Average/Mean KPI
            avg_reason = (
                f"Price/rate-like measure; average is more meaningful than sum"
                if nature == "price_rate"
                else f"Arithmetic mean of measure column '{col}'"
            )
            kpis.append(
                KPIMetric(
                    name=f"Average {base_title}",
                    value=round(mean_val, 2),
                    metric_type="mean",
                    source_column=col,
                    format="number",
                    reason=avg_reason,
                )
            )

            # 3. Median KPI
            kpis.append(
                KPIMetric(
                    name=f"Median {base_title}",
                    value=round(median_val, 2),
                    metric_type="median",
                    source_column=col,
                    format="number",
                    reason=f"50th percentile (median) of measure column '{col}'",
                )
            )

            # 4. Min KPI
            kpis.append(
                KPIMetric(
                    name=f"Min {base_title}",
                    value=int(round(min_val)) if fmt == "integer" else round(min_val, 2),
                    metric_type="min",
                    source_column=col,
                    format=fmt,
                    reason=f"Minimum observed value of measure column '{col}'",
                )
            )

            # 5. Max KPI
            kpis.append(
                KPIMetric(
                    name=f"Max {base_title}",
                    value=int(round(max_val)) if fmt == "integer" else round(max_val, 2),
                    metric_type="max",
                    source_column=col,
                    format=fmt,
                    reason=f"Maximum observed value of measure column '{col}'",
                )
            )

            # 6. Std Dev KPI (for price/rate measures)
            if nature == "price_rate" and len(series) > 1:
                kpis.append(
                    KPIMetric(
                        name=f"Std Dev {base_title}",
                        value=round(std_val, 2),
                        metric_type="std",
                        source_column=col,
                        format="number",
                        reason=f"Standard deviation measuring volatility of price/rate column '{col}'",
                    )
                )

        return kpis

    @classmethod
    def discover_category_breakdowns(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> List[CategoryBreakdown]:
        breakdowns: List[CategoryBreakdown] = []

        dimensions = [r.column for r in roles if r.role == "categorical_dimension"][:5]
        measures = [r.column for r in roles if r.role == "measure"][:5]

        for dim in dimensions:
            for m in measures:
                clean_df = df[[dim, m]].dropna().copy()
                if len(clean_df) == 0:
                    continue

                clean_df[m] = pd.to_numeric(clean_df[m], errors="coerce")
                clean_df = clean_df.dropna(subset=[m])
                if len(clean_df) == 0:
                    continue

                nature = cls.classify_measure_nature(m, clean_df[m])

                if nature == "price_rate":
                    # For price/rate metrics, group by AVERAGE (mean)
                    agg_method = "mean"
                    grouped = clean_df.groupby(dim)[m].mean().reset_index()
                    grouped = grouped.sort_values(by=m, ascending=False)
                    overall_val = float(clean_df[m].mean())
                    denom = 0.0  # Non-additive metric: contribution % is non-applicable
                else:
                    # For quantity or amount metrics, group by TOTAL (sum)
                    agg_method = "sum"
                    grouped = clean_df.groupby(dim)[m].sum().reset_index()
                    grouped = grouped.sort_values(by=m, ascending=False)
                    overall_val = float(grouped[m].sum())
                    denom = overall_val

                if agg_method == "sum" and denom == 0:
                    continue

                grouped_items: List[GroupedCategoryValue] = []
                for _, row in grouped.iterrows():
                    val = float(row[m])
                    pct = round((val / denom) * 100.0, 2) if denom > 0 else 0.0
                    grouped_items.append(
                        GroupedCategoryValue(
                            category_value=str(row[dim]),
                            metric_value=round(val, 2),
                            contribution_pct=pct,
                        )
                    )

                top_cat = grouped_items[0] if len(grouped_items) > 0 else None
                bottom_cat = grouped_items[-1] if len(grouped_items) > 0 else None

                top_5 = grouped_items[:5]
                bottom_5 = grouped_items[-5:] if len(grouped_items) >= 5 else list(reversed(grouped_items))

                breakdowns.append(
                    CategoryBreakdown(
                        dimension=dim,
                        measure=m,
                        total_measure_value=round(overall_val, 2),
                        aggregation_method=agg_method,
                        top_category=top_cat,
                        bottom_category=bottom_cat,
                        top_5=top_5,
                        bottom_5=bottom_5,
                        grouped_data=grouped_items,
                    )
                )

        return breakdowns
