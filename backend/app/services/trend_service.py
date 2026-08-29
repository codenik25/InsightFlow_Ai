from typing import List, Optional
import pandas as pd
import numpy as np
from app.schemas.kpi import ColumnRoleInfo
from app.schemas.eda import TrendMetric, TimeSeriesPoint


from app.services.kpi_service import KPIService


class TrendService:
    """Deterministic time-series aggregation and trend classification engine."""

    @classmethod
    def evaluate_trends(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> List[TrendMetric]:
        trends: List[TrendMetric] = []

        datetime_cols = [r.column for r in roles if r.role == "datetime_dimension"]
        measures = [r.column for r in roles if r.role == "measure"]

        if not datetime_cols or not measures:
            return trends

        for dt_col in datetime_cols[:2]:  # Limit to top 2 datetime columns
            clean_dt = pd.to_datetime(df[dt_col], errors="coerce")
            valid_mask = clean_dt.notna()

            if valid_mask.sum() < 3:
                continue

            min_dt = clean_dt[valid_mask].min()
            max_dt = clean_dt[valid_mask].max()
            span_days = (max_dt - min_dt).days

            # Determine granularity
            if span_days <= 45:
                granularity = "daily"
                freq = "D"
            elif span_days <= 180:
                granularity = "weekly"
                freq = "W"
            else:
                granularity = "monthly"
                freq = "M"

            for m in measures[:5]:
                sub_df = df[valid_mask].copy()
                sub_df["_dt"] = clean_dt[valid_mask]
                valid_m = KPIService.filter_valid_numeric_series(sub_df[m], m)
                sub_df = sub_df.loc[valid_m.index].copy()
                sub_df[m] = valid_m

                if len(sub_df) < 3:
                    continue

                resampled = sub_df.set_index("_dt").resample(freq)[m].agg(["sum", "count"]).reset_index()
                resampled = resampled[resampled["count"] > 0]

                if len(resampled) < 2:
                    trends.append(
                        TrendMetric(
                            measure=m,
                            datetime_column=dt_col,
                            granularity=granularity,
                            trend_direction="insufficient_data",
                            slope=0.0,
                            pct_change=0.0,
                            time_series=[],
                        )
                    )
                    continue

                ts_points: List[TimeSeriesPoint] = []
                for _, r in resampled.iterrows():
                    period_str = r["_dt"].strftime("%Y-%m-%d")
                    ts_points.append(
                        TimeSeriesPoint(
                            period=period_str,
                            value=round(float(r["sum"]), 2),
                            count=int(r["count"]),
                        )
                    )

                values = [p.value for p in ts_points]
                first_val = values[0]
                latest_val = values[-1]

                # Percentage change from first period to latest period
                if first_val != 0:
                    pct_change = round(((latest_val - first_val) / abs(first_val)) * 100.0, 2)
                else:
                    pct_change = 100.0 if latest_val > 0 else 0.0

                # Linear regression slope over normalized indices [0..n-1]
                x = np.arange(len(values))
                y = np.array(values)
                if len(x) >= 2:
                    slope, _ = np.polyfit(x, y, 1)
                    slope = round(float(slope), 4)
                else:
                    slope = 0.0

                # Trend classification
                if len(values) < 2:
                    direction = "insufficient_data"
                elif pct_change > 1.0 and slope > 0:
                    direction = "increasing"
                elif pct_change < -1.0 and slope < 0:
                    direction = "decreasing"
                else:
                    direction = "stable"

                trends.append(
                    TrendMetric(
                        measure=m,
                        datetime_column=dt_col,
                        granularity=granularity,
                        trend_direction=direction,
                        slope=slope,
                        pct_change=pct_change,
                        first_period_value=round(first_val, 2),
                        latest_period_value=round(latest_val, 2),
                        time_series=ts_points,
                    )
                )

        return trends
