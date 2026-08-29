import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from sklearn.ensemble import RandomForestRegressor
try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from app.models.dataset import Dataset
from app.models.forecast_analysis import ForecastAnalysis
from app.schemas.forecast import (
    ForecastTaskCandidate,
    ForecastTaskDiscoveryResponse,
    ForecastPoint,
    ForecastMetrics,
    ForecastAnalysisResponse,
)
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.metric_discovery_service import MetricDiscoveryService


class ForecastingService:
    """Production Service for Time-Series Demand Forecasting with Chronological Safety and Uncertainty Intervals."""

    DEMAND_TARGET_KEYWORDS = ["units_sold", "sales", "orders", "revenue", "demand", "quantity", "units", "amount"]

    @classmethod
    def discover_forecast_tasks(cls, db: Session, dataset_id: str) -> ForecastTaskDiscoveryResponse:
        """Inspect processed dataset and discover viable time-series demand forecasting candidate tasks."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)
        roles = MetricDiscoveryService.discover_column_roles(df)

        dt_cols = [r.column for r in roles if r.role == "datetime_dimension"]
        num_cols = [r.column for r in roles if r.role == "measure"]

        # Fallback date detection if role missing
        if not dt_cols:
            for col in df.columns:
                if "date" in col.lower() or "time" in col.lower() or "day" in col.lower():
                    dt_cols.append(col)

        candidates: List[ForecastTaskCandidate] = []
        if dt_cols and num_cols:
            time_col = dt_cols[0]
            # Check for multiple observations per timestamp
            time_series_clean = df.dropna(subset=[time_col]).copy()
            time_series_clean[time_col] = pd.to_datetime(time_series_clean[time_col], errors="coerce")
            time_series_clean = time_series_clean.dropna(subset=[time_col])
            
            unique_time_count = time_series_clean[time_col].nunique()
            max_recs_per_date = int(time_series_clean.groupby(time_col).size().max()) if unique_time_count > 0 else 1
            has_duplicates = max_recs_per_date > 1

            for num_col in num_cols:
                col_lower = num_col.lower()
                is_keyword_match = any(kw in col_lower for kw in cls.DEMAND_TARGET_KEYWORDS)

                score = 0.85
                if is_keyword_match:
                    score += 0.10
                if unique_time_count >= 30:
                    score += 0.04
                score = min(score, 0.98)

                reasons = [
                    f"Time dimension column '{time_col}' identified for sequential ordering",
                    f"Numeric target measure '{num_col}' available for time-series forecasting",
                    "Chronological train/validation splitting can be enforced (no temporal leakage)",
                ]
                warnings = []

                if has_duplicates:
                    agg_rule = "sum" if any(kw in col_lower for kw in cls.DEMAND_TARGET_KEYWORDS) else "mean"
                    reasons.append(
                        f"Detected up to {max_recs_per_date} records per timestamp. System will aggregate '{num_col}' by '{time_col}' using '{agg_rule}' aggregation."
                    )
                if unique_time_count < 30:
                    warnings.append(
                        f"Small time-series sample size ({unique_time_count} unique temporal observations); forecast confidence is EXPLORATORY."
                    )

                candidates.append(
                    ForecastTaskCandidate(
                        task_type="time_series_forecasting",
                        target_column=num_col,
                        time_column=time_col,
                        suitability_score=round(score, 2),
                        reasons=reasons,
                        warnings=warnings,
                    )
                )

        candidates.sort(key=lambda x: x.suitability_score, reverse=True)

        return ForecastTaskDiscoveryResponse(
            dataset_id=target_dataset.id,
            candidate_tasks=candidates,
            message="Forecasting tasks discovered successfully."
            if candidates
            else "No suitable time-series forecasting configuration found in dataset.",
        )

    @classmethod
    def _engineer_temporal_features(
        cls, df: pd.DataFrame, time_col: str, target_col: str
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Engineer deterministic lag, rolling, and calendar temporal features strictly in chronological order."""
        work_df = df.copy()
        
        # Parse time column
        work_df[time_col] = pd.to_datetime(work_df[time_col], errors="coerce")
        work_df = work_df.sort_values(by=time_col).reset_index(drop=True)

        # Basic trend index
        work_df["trend_index"] = np.arange(len(work_df))
        feature_cols = ["trend_index"]

        # Calendar features
        if work_df[time_col].dt.dayofweek.notna().any():
            work_df["day_of_week"] = work_df[time_col].dt.dayofweek.fillna(0).astype(int)
            work_df["day_of_month"] = work_df[time_col].dt.day.fillna(1).astype(int)
            work_df["month"] = work_df[time_col].dt.month.fillna(1).astype(int)
            feature_cols.extend(["day_of_week", "day_of_month", "month"])

        n_rows = len(work_df)
        target = work_df[target_col]

        # Lags (only if sufficient data)
        if n_rows >= 6:
            work_df["lag_1"] = target.shift(1).bfill().fillna(target.mean())
            feature_cols.append("lag_1")
        if n_rows >= 14:
            work_df["lag_7"] = target.shift(7).bfill().fillna(target.mean())
            feature_cols.append("lag_7")

        # Rolling averages (only if sufficient data)
        if n_rows >= 6:
            work_df["rolling_mean_3"] = target.shift(1).rolling(window=3, min_periods=1).mean().fillna(target.mean())
            feature_cols.append("rolling_mean_3")

        return work_df, feature_cols

    @classmethod
    def analyze_and_forecast(
        cls,
        db: Session,
        dataset_id: str,
        target_column: Optional[str] = None,
        time_column: Optional[str] = None,
        horizon: int = 30,
    ) -> ForecastAnalysisResponse:
        """Execute chronological forecasting pipeline, evaluate model metrics, project future demand, and persist result."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)

        # Auto-discover target and time column if missing
        disc = cls.discover_forecast_tasks(db=db, dataset_id=dataset_id)
        if not disc.candidate_tasks and not (target_column and time_column):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset is not suitable for time-series demand forecasting (missing date or target measure).",
            )

        if not target_column or not time_column:
            top_cand = disc.candidate_tasks[0]
            target_column = target_column or top_cand.target_column
            time_column = time_column or top_cand.time_column

        if target_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target column '{target_column}' not found in dataset.",
            )
        if time_column not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time column '{time_column}' not found in dataset.",
            )

        clean_df = df.dropna(subset=[target_column, time_column]).copy()
        clean_df[time_column] = pd.to_datetime(clean_df[time_column], errors="coerce")
        clean_df = clean_df.dropna(subset=[time_column]).sort_values(by=time_column).reset_index(drop=True)

        if len(clean_df) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset contains fewer than 5 valid historical records for forecasting.",
            )

        # 1. Temporal Aggregation Strategy for Multi-Entity Records
        warnings: List[str] = []
        records_per_date = clean_df.groupby(time_column).size()
        max_records_per_date = int(records_per_date.max()) if not records_per_date.empty else 1
        has_duplicates = max_records_per_date > 1

        col_lower = target_column.lower()
        agg_rule = "sum" if any(kw in col_lower for kw in cls.DEMAND_TARGET_KEYWORDS) else "mean"

        if has_duplicates:
            if agg_rule == "sum":
                agg_df = clean_df.groupby(time_column)[target_column].sum().reset_index()
            else:
                agg_df = clean_df.groupby(time_column)[target_column].mean().reset_index()
            
            agg_df = agg_df.sort_values(by=time_column).reset_index(drop=True)
            warnings.append(
                f"Dataset contains up to {max_records_per_date} records per timestamp. "
                f"Aggregated target measure '{target_column}' by timestamp using explicit '{agg_rule}' aggregation for time-series modeling."
            )
        else:
            agg_df = clean_df[[time_column, target_column]].sort_values(by=time_column).reset_index(drop=True)

        if len(agg_df) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset contains fewer than 5 unique historical timestamps for forecasting.",
            )

        # 2. Inferred Historical Frequency & Date Offsets
        unique_dates = pd.to_datetime(agg_df[time_column])
        date_diffs = unique_dates.diff().dropna()
        median_days = float(date_diffs.dt.days.median()) if not date_diffs.empty else 1.0

        # Engineer temporal features on aggregated time series
        featured_df, feature_cols = cls._engineer_temporal_features(agg_df, time_column, target_column)
        n_rows = len(featured_df)

        # 3. Chronological train / validation split
        train_size = max(int(n_rows * 0.8), n_rows - max(2, int(n_rows * 0.2)))
        if train_size >= n_rows:
            train_size = n_rows - 1

        train_df = featured_df.iloc[:train_size]
        test_df = featured_df.iloc[train_size:]

        X_train, y_train = train_df[feature_cols], train_df[target_column]
        X_test, y_test = test_df[feature_cols], test_df[target_column]

        # Model selection: XGBRegressor if available, else RandomForestRegressor
        if HAS_XGBOOST and n_rows >= 10:
            model = XGBRegressor(n_estimators=50, random_state=42, learning_rate=0.1, max_depth=3)
        else:
            model = RandomForestRegressor(n_estimators=50, random_state=42)

        model.fit(X_train, y_train)
        test_preds = model.predict(X_test)

        mae = float(np.mean(np.abs(y_test - test_preds)))
        rmse = float(np.sqrt(np.mean((y_test - test_preds) ** 2)))
        y_mean = float(np.mean(y_test))
        ss_tot = float(np.sum((y_test - y_mean) ** 2))
        ss_res = float(np.sum((y_test - test_preds) ** 2))
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0

        mape = float(np.mean(np.abs((y_test - test_preds) / y_test)) * 100.0) if np.all(np.abs(y_test) > 1e-6) else None

        metrics = ForecastMetrics(
            mae=round(mae, 4),
            rmse=round(rmse, 4),
            r2=round(r2, 4),
            mape=round(mape, 2) if mape is not None else None,
        )

        # 4. Determine confidence level & honest warnings
        if n_rows < 30 or r2 < 0.20 or (mape is not None and mape > 35.0):
            confidence = "EXPLORATORY"
            if n_rows < 30:
                warnings.append(
                    f"Small historical sample size ({n_rows} aggregated time periods). Forecast metrics are exploratory."
                )
            if r2 < 0.20:
                warnings.append(
                    f"Model validation R² score ({round(r2, 4)}) indicates limited predictive power; proceed with caution."
                )
        elif n_rows < 100:
            confidence = "LIMITED"
            warnings.append(
                f"Moderate historical sample size ({n_rows} aggregated time periods). Forecast carries limited confidence."
            )
        else:
            confidence = "STANDARD"

        # Fit model on full aggregated dataset for future horizon projection
        X_full, y_full = featured_df[feature_cols], featured_df[target_column]
        model.fit(X_full, y_full)

        full_residuals = y_full - model.predict(X_full)
        residual_std = float(np.std(full_residuals)) if len(full_residuals) > 1 else (0.1 * float(np.mean(y_full)))
        residual_std = max(residual_std, 1e-3)

        # 5. Generate future dates conforming to historical frequency
        last_dt = pd.to_datetime(featured_df[time_column].iloc[-1])
        future_points: List[ForecastPoint] = []
        last_val = float(y_full.iloc[-1])

        for h in range(1, horizon + 1):
            if 27.0 <= median_days <= 32.0:
                next_dt = last_dt + pd.DateOffset(months=h)
            elif 6.0 <= median_days <= 8.0:
                next_dt = last_dt + pd.DateOffset(weeks=h)
            elif 350.0 <= median_days <= 370.0:
                next_dt = last_dt + pd.DateOffset(years=h)
            else:
                step_days = max(1, int(round(median_days)))
                next_dt = last_dt + timedelta(days=h * step_days)

            next_trend = n_rows - 1 + h

            feature_dict: Dict[str, Any] = {"trend_index": next_trend}
            if "day_of_week" in feature_cols:
                feature_dict["day_of_week"] = next_dt.dayofweek
                feature_dict["day_of_month"] = next_dt.day
                feature_dict["month"] = next_dt.month
            if "lag_1" in feature_cols:
                feature_dict["lag_1"] = last_val
            if "lag_7" in feature_cols:
                feature_dict["lag_7"] = last_val
            if "rolling_mean_3" in feature_cols:
                feature_dict["rolling_mean_3"] = last_val

            X_fut = pd.DataFrame([feature_dict])[feature_cols]
            pred_val = float(model.predict(X_fut)[0])

            # Non-negative demand constraint if historical target >= 0
            if (y_full >= 0).all():
                pred_val = max(0.0, pred_val)

            lower_b = max(0.0, pred_val - 1.96 * residual_std) if (y_full >= 0).all() else (pred_val - 1.96 * residual_std)
            upper_b = pred_val + 1.96 * residual_std

            future_points.append(
                ForecastPoint(
                    date=next_dt.strftime("%Y-%m-%d"),
                    predicted_value=round(pred_val, 2),
                    lower_bound=round(lower_b, 2),
                    upper_bound=round(upper_b, 2),
                )
            )
            last_val = pred_val

        # 6. Historical series formatting (up to 50 unique aggregated records)
        hist_records = []
        for idx, row in featured_df.tail(50).iterrows():
            dt_str = pd.to_datetime(row[time_column]).strftime("%Y-%m-%d")
            hist_records.append({"date": dt_str, "value": round(float(row[target_column]), 2)})

        # Deterministic non-causal business insights
        mean_hist = float(np.mean(y_full))
        mean_forecast = float(np.mean([p.predicted_value for p in future_points]))
        pct_change = round(((mean_forecast - mean_hist) / mean_hist) * 100.0, 2) if mean_hist > 0 else 0.0

        peak_pt = max(future_points, key=lambda x: x.predicted_value)
        low_pt = min(future_points, key=lambda x: x.predicted_value)

        trend_direction = "increase" if pct_change > 2.0 else ("decrease" if pct_change < -2.0 else "stability")

        insights = {
            "summary": f"The model projects a {pct_change}% expected demand {trend_direction} over the next {horizon} periods relative to historical average.",
            "historical_mean": round(mean_hist, 2),
            "forecast_mean": round(mean_forecast, 2),
            "percentage_change": pct_change,
            "peak_period": {"date": peak_pt.date, "predicted_value": peak_pt.predicted_value},
            "lowest_period": {"date": low_pt.date, "predicted_value": low_pt.predicted_value},
            "non_causal_statement": "The forecast indicates expected future observations based on historical temporal patterns; it does not constitute a guaranteed causal outcome.",
        }

        analysis_id = str(uuid.uuid4())
        record = ForecastAnalysis(
            id=analysis_id,
            dataset_id=target_dataset.id,
            target_column=target_column,
            time_column=time_column,
            horizon=horizon,
            confidence=confidence,
            metrics=metrics.model_dump(),
            forecast_data=[p.model_dump() for p in future_points],
            insights=insights,
            warnings=warnings,
        )
        db.add(record)
        db.commit()

        return ForecastAnalysisResponse(
            forecast_id=analysis_id,
            dataset_id=target_dataset.id,
            target_column=target_column,
            time_column=time_column,
            horizon=horizon,
            confidence=confidence,
            sample_size=n_rows,
            metrics=metrics,
            forecast=future_points,
            historical=hist_records,
            insights=insights,
            warnings=warnings,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def get_forecast_by_id(cls, db: Session, dataset_id: str, forecast_id: str) -> ForecastAnalysisResponse:
        """Fetch single saved forecast analysis by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(ForecastAnalysis).where(
            ForecastAnalysis.id == forecast_id, ForecastAnalysis.dataset_id == target_dataset.id
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Forecast Analysis '{forecast_id}' not found for dataset '{dataset_id}'.",
            )

        return ForecastAnalysisResponse(
            forecast_id=record.id,
            dataset_id=record.dataset_id,
            target_column=record.target_column,
            time_column=record.time_column,
            horizon=record.horizon,
            confidence=record.confidence,
            sample_size=0,
            metrics=ForecastMetrics(**record.metrics),
            forecast=[ForecastPoint(**p) for p in record.forecast_data],
            insights=record.insights,
            warnings=record.warnings or [],
            created_at=record.created_at.isoformat() if record.created_at else None,
        )
