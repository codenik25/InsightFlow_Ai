import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from app.models.dataset import Dataset
from app.models.anomaly_analysis import AnomalyAnalysis
from app.schemas.anomaly import (
    AnomalyFeatureDeviation,
    AnomalyItem,
    AnomalyAnalysisResponse,
)
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.metric_discovery_service import MetricDiscoveryService


class AnomalyService:
    """Production Service for Unsupervised Anomaly Intelligence using Isolation Forest and Feature Attribution."""

    @classmethod
    def analyze_anomalies(
        cls,
        db: Session,
        dataset_id: str,
        feature_columns: Optional[List[str]] = None,
        contamination: Optional[float] = None,
    ) -> AnomalyAnalysisResponse:
        """Run Isolation Forest anomaly detection, compute anomaly scores, classify severity, attribute feature deviations, and persist results."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)

        # Feature selection: discover numeric measures
        roles = MetricDiscoveryService.discover_column_roles(df)
        available_numeric = [r.column for r in roles if r.role == "measure"]
        df_numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if not available_numeric:
            available_numeric = df_numeric_cols

        if feature_columns:
            selected_features = [f for f in feature_columns if f in df_numeric_cols]
        else:
            selected_features = available_numeric

        if not selected_features:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset contains no valid numeric feature columns for anomaly detection.",
            )

        X_raw = df[selected_features].copy()
        n_obs = len(df)

        if n_obs < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset contains fewer than 3 observations; anomaly detection cannot be performed.",
            )

        # Contamination parameter validation
        if contamination is not None:
            if contamination < 0.001 or contamination > 0.5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Contamination parameter '{contamination}' must be between 0.001 and 0.5.",
                )
            contam = contamination
        else:
            contam = "auto"

        # Preprocessing pipeline
        imputer = SimpleImputer(strategy="mean")
        scaler = StandardScaler()
        X_imputed = imputer.fit_transform(X_raw)
        X_scaled = scaler.fit_transform(X_imputed)

        # Isolation Forest fit
        model = IsolationForest(n_estimators=100, contamination=contam, random_state=42)
        model.fit(X_scaled)

        preds = model.predict(X_scaled)  # -1 for anomaly, 1 for normal
        raw_scores = model.score_samples(X_scaled)  # Lower is more anomalous

        # Normalize score between 0.0 and 1.0 (1.0 = highly anomalous)
        min_s, max_s = float(np.min(raw_scores)), float(np.max(raw_scores))
        if max_s > min_s:
            norm_scores = 1.0 - ((raw_scores - min_s) / (max_s - min_s))
        else:
            norm_scores = np.zeros_like(raw_scores)

        # Feature column statistics for deviation attribution
        means = np.mean(X_imputed, axis=0)
        stds = np.std(X_imputed, axis=0)
        stds = np.where(stds < 1e-6, 1.0, stds)

        anomaly_items: List[AnomalyItem] = []
        high_severity_count = 0
        anomaly_count = 0

        score_dist = {"0.0-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}

        for i in range(n_obs):
            score = float(norm_scores[i])
            is_anomaly = (preds[i] == -1)

            if score < 0.4:
                score_dist["0.0-0.4"] += 1
            elif score < 0.6:
                score_dist["0.4-0.6"] += 1
            elif score < 0.8:
                score_dist["0.6-0.8"] += 1
            else:
                score_dist["0.8-1.0"] += 1

            if is_anomaly:
                anomaly_count += 1
                status_str = "ANOMALOUS"
                if score >= 0.75:
                    severity = "HIGH"
                    high_severity_count += 1
                elif score >= 0.60:
                    severity = "MEDIUM"
                else:
                    severity = "LOW"
            else:
                status_str = "NORMAL"
                severity = "LOW"

            # Compute feature Z-scores for attribution
            row_vals = X_imputed[i]
            z_scores = (row_vals - means) / stds

            deviations: List[AnomalyFeatureDeviation] = []
            for j, fcol in enumerate(selected_features):
                z_val = float(z_scores[j])
                raw_v = df.iloc[i][fcol] if fcol in df.columns else row_vals[j]
                if abs(z_val) >= 1.2:
                    direction = "above" if z_val > 0 else "below"
                    deviations.append(
                        AnomalyFeatureDeviation(
                            feature=fcol,
                            observed_value=float(raw_v) if isinstance(raw_v, (int, float, np.number)) else str(raw_v),
                            expected_mean=round(float(means[j]), 2),
                            std_dev=round(float(stds[j]), 2),
                            deviation_zscore=round(z_val, 2),
                            description=f"Value is {abs(round(z_val, 1))} std dev {direction} expected mean ({round(float(means[j]), 2)}).",
                        )
                    )

            deviations.sort(key=lambda x: abs(x.deviation_zscore), reverse=True)
            top_devs = deviations[:3]

            if is_anomaly and top_devs:
                dev_str = ", ".join([f"'{d.feature}'" for d in top_devs])
                explanation = f"Statistically unusual observation where values for {dev_str} deviate significantly from expected dataset distributions."
            elif is_anomaly:
                explanation = "Isolation Forest identified this observation as an atypical combination across numerical feature dimensions."
            else:
                explanation = "Observation conforms to expected numerical feature distribution boundaries."

            raw_dict = {}
            for fcol in selected_features[:10]:
                val = df.iloc[i][fcol]
                raw_dict[fcol] = float(val) if isinstance(val, (int, float, np.number)) else str(val)

            anomaly_items.append(
                AnomalyItem(
                    row_id=i,
                    anomaly_score=round(score, 4),
                    status=status_str,
                    severity=severity,
                    explanation=explanation,
                    feature_deviations=top_devs,
                    raw_values=raw_dict,
                )
            )

        anomaly_rate = round((anomaly_count / n_obs) * 100.0, 2) if n_obs > 0 else 0.0

        warnings: List[str] = []
        if n_obs < 30:
            confidence = "EXPLORATORY"
            warnings.append(f"Small sample size ({n_obs} observations); anomaly scores should be treated as exploratory.")
        elif n_obs < 100:
            confidence = "LIMITED"
            warnings.append(f"Moderate sample size ({n_obs} observations); anomaly severity labels carry limited confidence.")
        else:
            confidence = "STANDARD"

        # Sort item display: anomalous high-severity items first, then by score descending
        anomaly_items.sort(key=lambda x: (x.status == "ANOMALOUS", x.severity == "HIGH", x.anomaly_score), reverse=True)

        analysis_id = str(uuid.uuid4())
        results_payload = {
            "anomalies": [item.model_dump() for item in anomaly_items[:200]],
            "score_distribution": score_dist,
        }

        record = AnomalyAnalysis(
            id=analysis_id,
            dataset_id=target_dataset.id,
            total_observations=n_obs,
            anomaly_count=anomaly_count,
            anomaly_rate=anomaly_rate,
            high_severity_count=high_severity_count,
            confidence=confidence,
            feature_columns=selected_features,
            results_data=results_payload,
            warnings=warnings,
        )
        db.add(record)
        db.commit()

        return AnomalyAnalysisResponse(
            anomaly_id=analysis_id,
            dataset_id=target_dataset.id,
            total_observations=n_obs,
            anomaly_count=anomaly_count,
            anomaly_rate=anomaly_rate,
            high_severity_count=high_severity_count,
            confidence=confidence,
            sample_size=n_obs,
            feature_columns=selected_features,
            anomalies=anomaly_items[:200],
            warnings=warnings,
            score_distribution=score_dist,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def get_anomaly_by_id(cls, db: Session, dataset_id: str, anomaly_id: str) -> AnomalyAnalysisResponse:
        """Fetch single saved anomaly analysis by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(AnomalyAnalysis).where(
            AnomalyAnalysis.id == anomaly_id, AnomalyAnalysis.dataset_id == target_dataset.id
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Anomaly Analysis '{anomaly_id}' not found for dataset '{dataset_id}'.",
            )

        res_data = record.results_data or {}
        items = [AnomalyItem(**item) for item in res_data.get("anomalies", [])]

        return AnomalyAnalysisResponse(
            anomaly_id=record.id,
            dataset_id=record.dataset_id,
            total_observations=record.total_observations,
            anomaly_count=record.anomaly_count,
            anomaly_rate=record.anomaly_rate,
            high_severity_count=record.high_severity_count,
            confidence=record.confidence,
            sample_size=record.total_observations,
            feature_columns=record.feature_columns,
            anomalies=items,
            warnings=record.warnings or [],
            score_distribution=res_data.get("score_distribution", {}),
            created_at=record.created_at.isoformat() if record.created_at else None,
        )

    @classmethod
    def get_anomalies_for_dataset(cls, db: Session, dataset_id: str) -> List[AnomalyAnalysisResponse]:
        """Fetch stored anomaly analyses for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(AnomalyAnalysis)
            .where(AnomalyAnalysis.dataset_id == target_dataset.id)
            .order_by(AnomalyAnalysis.created_at.desc())
        )
        records = db.scalars(stmt).all()
        return [cls.get_anomaly_by_id(db, dataset_id, r.id) for r in records]
