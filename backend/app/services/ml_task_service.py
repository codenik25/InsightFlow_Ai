import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.dummy import DummyRegressor, DummyClassifier
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest

from app.core.config import settings
from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.schemas.ml import (
    MLTaskCandidate,
    MLTaskDiscoveryResponse,
    MLFeatureInfo,
    MLModelCandidate,
    MLModelMetrics,
    MLAnalysisResponse,
    PredictionResponse,
)
from app.schemas.kpi import ColumnRoleInfo
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.type_detector import TypeDetector
from app.services.ml_feature_service import MLFeatureService



def ensure_models_dir():
    settings.models_dir_path.mkdir(parents=True, exist_ok=True)


class TimeSeriesNaiveModel:
    """Baseline Naive Last-Value Forecaster."""
    def __init__(self):
        self.last_value = 0.0

    def fit(self, X, y):
        if len(y) > 0:
            self.last_value = float(y.iloc[-1] if hasattr(y, 'iloc') else y[-1])
        return self

    def predict(self, X):
        return np.full(shape=(len(X),), fill_value=self.last_value)


class TimeSeriesMovingAverageModel:
    """Baseline Moving Average Forecaster."""
    def __init__(self, window: int = 3):
        self.window = window
        self.ma_value = 0.0

    def fit(self, X, y):
        if len(y) > 0:
            s = pd.Series(y)
            self.ma_value = float(s.tail(self.window).mean())
        return self

    def predict(self, X):
        return np.full(shape=(len(X),), fill_value=self.ma_value)


class MLTaskService:
    """Orchestrator for ML Task Discovery, Baseline Model Training, Evaluation, Artifact Persistence, and Prediction."""

    @classmethod
    def discover_tasks(cls, df: pd.DataFrame) -> MLTaskDiscoveryResponse:
        """Inspect processed dataset and discover viable candidate ML tasks."""
        roles = MetricDiscoveryService.discover_column_roles(df)
        candidates: List[MLTaskCandidate] = []
        total_rows = len(df)

        numeric_measures = [r for r in roles if r.role == "measure"]
        categorical_dims = [r for r in roles if r.role == "categorical_dimension" or r.role == "boolean"]
        datetime_dims = [r for r in roles if r.role == "datetime_dimension"]

        # 1. Regression Candidates
        for measure in numeric_measures:
            col_name = measure.column
            series = df[col_name].dropna()
            if len(series) < 10:
                continue

            unique_vals = series.nunique()
            if unique_vals < 5:
                continue

            # Calculate suitability score
            score = 0.70
            if total_rows >= 15:
                score += 0.10
            if len(df.columns) >= 3:
                score += 0.10
            if series.std() > 0:
                score += 0.05
            score = min(score, 0.95)

            reasons = [
                f"Target '{col_name}' is a continuous numeric measure",
                f"{len(roles) - 1} dataset columns available as potential features",
                f"Sufficient non-null observations ({len(series)} rows)",
            ]
            warnings = []
            if total_rows < 30:
                warnings.append(f"Small dataset size ({total_rows} rows); evaluation accuracy will be exploratory.")

            candidates.append(
                MLTaskCandidate(
                    task_type="regression",
                    target_column=col_name,
                    suitability_score=round(score, 2),
                    reasons=reasons,
                    warnings=warnings,
                    required_conditions=["Continuous target column", "At least 10 non-null observations"],
                )
            )

        # 2. Classification Candidates
        for cat in categorical_dims:
            col_name = cat.column
            series = df[col_name].dropna()
            unique_count = series.nunique()
            if unique_count < 2 or unique_count > 20:
                continue

            score = 0.65
            if 2 <= unique_count <= 10:
                score += 0.15
            if total_rows >= 15:
                score += 0.10
            score = min(score, 0.92)

            reasons = [
                f"Target '{col_name}' is a discrete categorical column with {unique_count} distinct classes",
                f"Class cardinality ({unique_count}) is suitable for supervised classification",
            ]
            warnings = []
            if total_rows < 30:
                warnings.append(f"Small sample size ({total_rows} rows); limited data per class.")

            candidates.append(
                MLTaskCandidate(
                    task_type="classification",
                    target_column=col_name,
                    suitability_score=round(score, 2),
                    reasons=reasons,
                    warnings=warnings,
                    required_conditions=["Discrete target column", "Between 2 and 20 unique categories"],
                )
            )

        # 3. Time-Series Forecasting Candidates
        if datetime_dims and numeric_measures:
            dt_col = datetime_dims[0].column
            for measure in numeric_measures:
                col_name = measure.column
                score = 0.85
                if total_rows >= 15:
                    score += 0.09
                score = min(score, 0.98)

                reasons = [
                    f"Time dimension column '{dt_col}' detected in dataset",
                    f"Sequential measure target '{col_name}' available for forecasting",
                    f"Chronological evaluation split can be constructed",
                ]
                warnings = []
                if total_rows < 15:
                    warnings.append(f"Short time series length ({total_rows} periods); baseline forecasting only.")

                candidates.append(
                    MLTaskCandidate(
                        task_type="time_series_forecasting",
                        target_column=col_name,
                        suitability_score=round(score, 2),
                        reasons=reasons,
                        warnings=warnings,
                        required_conditions=["Valid datetime dimension", "Numeric continuous sequence target"],
                    )
                )

        # 4. Anomaly Detection Candidates
        if numeric_measures:
            score = 0.75
            if len(numeric_measures) >= 2:
                score += 0.10
            score = min(score, 0.90)

            candidates.append(
                MLTaskCandidate(
                    task_type="anomaly_detection",
                    target_column=None,
                    suitability_score=round(score, 2),
                    reasons=[
                        f"{len(numeric_measures)} numeric continuous measures available for unsupervised outlier detection",
                        "Isolation Forest statistical boundary evaluation can be performed",
                    ],
                    warnings=[],
                    required_conditions=["At least 1 numeric measure column"],
                )
            )

        # Rank candidate tasks by suitability score descending
        candidates.sort(key=lambda x: x.suitability_score, reverse=True)

        return MLTaskDiscoveryResponse(
            dataset_id="",
            is_processed=True,
            candidate_tasks=candidates,
            message="ML task candidates discovered successfully.",
        )

    @classmethod
    def run_analysis(
        cls,
        db: Session,
        dataset_id: str,
        task_type: Optional[str] = None,
        target_column: Optional[str] = None
    ) -> MLAnalysisResponse:
        """Run model analysis pipeline, evaluate baseline candidates, persist model artifact, and record result."""

        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)
        roles = MetricDiscoveryService.discover_column_roles(df)

        # If task_type not provided, auto-discover and select top candidate
        discovery_resp = cls.discover_tasks(df)
        if not discovery_resp.candidate_tasks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset is not suitable for automated ML analysis (no valid target or measures found).",
            )

        if not task_type:
            top_candidate = discovery_resp.candidate_tasks[0]
            task_type = top_candidate.task_type
            target_column = top_candidate.target_column
        elif not target_column and task_type != "anomaly_detection":
            matching = [c for c in discovery_resp.candidate_tasks if c.task_type == task_type]
            if matching:
                target_column = matching[0].target_column

        # Discover features
        feature_info_list = MLFeatureService.discover_features(df, target_column, roles)
        included_features = [f.name for f in feature_info_list if f.status == "included"]

        if not included_features and task_type != "anomaly_detection":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No suitable predictor features could be identified for this dataset.",
            )

        analysis_id = str(uuid.uuid4())
        ensure_models_dir()
        artifact_rel_path = f"data/models/{analysis_id}.joblib"
        artifact_full_path = str(settings.models_dir_path / f"{analysis_id}.joblib")

        data_warnings: List[str] = []
        if len(df) < 30:
            data_warnings.append(
                f"Prediction quality is limited by the available sample size ({len(df)} rows). Results should be interpreted with caution."
            )

        # Separate pipeline execution based on task_type
        if task_type == "regression":
            response = cls._run_regression_pipeline(
                df, target_column, included_features, feature_info_list, analysis_id, target_dataset.id, artifact_full_path, artifact_rel_path, data_warnings
            )
        elif task_type == "classification":
            response = cls._run_classification_pipeline(
                df, target_column, included_features, feature_info_list, analysis_id, target_dataset.id, artifact_full_path, artifact_rel_path, data_warnings
            )
        elif task_type == "time_series_forecasting":
            response = cls._run_time_series_pipeline(
                df, target_column, included_features, feature_info_list, analysis_id, target_dataset.id, artifact_full_path, artifact_rel_path, data_warnings, roles
            )
        elif task_type == "anomaly_detection":
            response = cls._run_anomaly_pipeline(
                df, included_features, feature_info_list, analysis_id, target_dataset.id, artifact_full_path, artifact_rel_path, data_warnings
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported task_type '{task_type}'.",
            )

        # Store record in database
        analysis_record = MLAnalysis(
            id=analysis_id,
            dataset_id=target_dataset.id,
            task_type=task_type,
            target_column=target_column,
            feature_columns=included_features,
            model_name=response.model_name,
            model_version=response.model_version,
            model_artifact_path=artifact_rel_path,
            feature_schema={"features": included_features, "target": target_column},
            preprocessing_config={"pipeline": "StandardScaler + OneHotEncoder / SimpleImputer"},
            random_seed=42,
            training_row_count=response.training_row_count,
            test_row_count=response.test_row_count,
            metrics=response.metrics,
            status="completed",
            result_data=response.model_dump(),
            selection_reason=response.selection_reason,
        )
        db.add(analysis_record)
        db.commit()

        return response

    @classmethod
    def _build_preprocessor(cls, X: pd.DataFrame) -> ColumnTransformer:
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

        transformers = []
        if numeric_cols:
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="mean")),
                ("scaler", StandardScaler()),
            ])
            transformers.append(("num", num_pipe, numeric_cols))

        if categorical_cols:
            cat_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ])
            transformers.append(("cat", cat_pipe, categorical_cols))

        return ColumnTransformer(transformers=transformers, remainder="drop")

    @classmethod
    def _run_regression_pipeline(
        cls,
        df: pd.DataFrame,
        target_col: str,
        features: List[str],
        feature_summary: List[MLFeatureInfo],
        analysis_id: str,
        dataset_id: str,
        artifact_full_path: str,
        artifact_rel_path: str,
        data_warnings: List[str],
    ) -> MLAnalysisResponse:
        clean_df = df.dropna(subset=[target_col]).copy()
        X = clean_df[features]
        y = clean_df[target_col]

        test_size = 0.2 if len(clean_df) >= 10 else 0.1
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )

        preprocessor = cls._build_preprocessor(X)

        candidate_models = [
            ("Dummy Regressor (Mean)", DummyRegressor(strategy="mean")),
            ("Linear Regression", LinearRegression()),
            ("Random Forest Regressor", RandomForestRegressor(n_estimators=50, random_state=42)),
        ]

        evaluated_candidates: List[MLModelCandidate] = []
        fitted_pipelines = {}

        best_name = ""
        best_rmse = float("inf")
        best_metrics: Dict[str, Optional[float]] = {}
        best_pipeline = None

        for name, model in candidate_models:
            pipe = Pipeline([
                ("preprocessor", preprocessor),
                ("regressor", model),
            ])
            pipe.fit(X_train, y_train)
            y_pred = pipe.predict(X_test)

            mae = float(np.mean(np.abs(y_test - y_pred)))
            rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))
            
            # R2
            y_mean = np.mean(y_test)
            ss_tot = np.sum((y_test - y_mean) ** 2)
            ss_res = np.sum((y_test - y_pred) ** 2)
            r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0

            # Safe MAPE
            if np.all(np.abs(y_test) > 1e-6):
                mape = float(np.mean(np.abs((y_test - y_pred) / y_test)) * 100)
            else:
                mape = None

            metrics_dict = {
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "r2": round(r2, 4),
                "mape": round(mape, 2) if mape is not None else None,
            }

            fitted_pipelines[name] = pipe

            if rmse < best_rmse:
                best_rmse = rmse
                best_name = name
                best_metrics = metrics_dict
                best_pipeline = pipe

        for name, _ in candidate_models:
            pipe = fitted_pipelines[name]
            y_pred = pipe.predict(X_test)
            mae = float(np.mean(np.abs(y_test - y_pred)))
            rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))
            is_best = (name == best_name)

            reason = (
                f"{name} selected because it achieved the lowest validation RMSE ({round(rmse, 4)}) among evaluated candidates."
                if is_best
                else f"Evaluated candidate with validation RMSE ({round(rmse, 4)})."
            )

            evaluated_candidates.append(
                MLModelCandidate(
                    model_name=name,
                    metrics={"rmse": round(rmse, 4), "mae": round(mae, 4)},
                    is_selected=is_best,
                    selection_reason=reason,
                )
            )

        # Save selected model artifact
        joblib.dump(best_pipeline, artifact_full_path)

        selection_explanation = f"{best_name} selected because it achieved the lowest validation RMSE ({best_metrics.get('rmse')}) among evaluated candidate models."

        return MLAnalysisResponse(
            id=analysis_id,
            dataset_id=dataset_id,
            task_type="regression",
            target_column=target_col,
            feature_summary=feature_summary,
            feature_columns=features,
            model_name=best_name,
            model_version="1.0",
            training_row_count=len(X_train),
            test_row_count=len(X_test),
            metrics=best_metrics,
            candidate_models=evaluated_candidates,
            status="completed",
            selection_reason=selection_explanation,
            data_warnings=data_warnings,
            model_artifact_path=artifact_rel_path,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def _run_classification_pipeline(
        cls,
        df: pd.DataFrame,
        target_col: str,
        features: List[str],
        feature_summary: List[MLFeatureInfo],
        analysis_id: str,
        dataset_id: str,
        artifact_full_path: str,
        artifact_rel_path: str,
        data_warnings: List[str],
    ) -> MLAnalysisResponse:
        clean_df = df.dropna(subset=[target_col]).copy()
        X = clean_df[features]
        y = clean_df[target_col].astype(str)

        # Check stratification capability
        class_counts = y.value_counts()
        can_stratify = (class_counts.min() >= 2) and len(clean_df) >= 10
        stratify_arg = y if can_stratify else None

        test_size = 0.2 if len(clean_df) >= 10 else 0.1
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=stratify_arg
        )

        preprocessor = cls._build_preprocessor(X)

        candidate_models = [
            ("Dummy Classifier (Most Frequent)", DummyClassifier(strategy="most_frequent")),
            ("Logistic Regression", LogisticRegression(max_iter=1000, random_state=42)),
            ("Random Forest Classifier", RandomForestClassifier(n_estimators=50, random_state=42)),
        ]

        evaluated_candidates: List[MLModelCandidate] = []
        fitted_pipelines = {}

        best_name = ""
        best_f1 = -1.0
        best_metrics: Dict[str, Optional[float]] = {}
        best_pipeline = None

        for name, model in candidate_models:
            pipe = Pipeline([
                ("preprocessor", preprocessor),
                ("classifier", model),
            ])
            pipe.fit(X_train, y_train)
            y_pred = pipe.predict(X_test)

            acc = float(np.mean(y_test == y_pred))
            
            # Simple weighted precision, recall, F1 calculation
            classes = np.unique(y_test)
            f1s = []
            precs = []
            recs = []
            for c in classes:
                tp = np.sum((y_test == c) & (y_pred == c))
                fp = np.sum((y_test != c) & (y_pred == c))
                fn = np.sum((y_test == c) & (y_pred != c))
                
                prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
                rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
                
                weight = np.sum(y_test == c) / len(y_test)
                f1s.append(f1 * weight)
                precs.append(prec * weight)
                recs.append(rec * weight)

            macro_f1 = float(np.sum(f1s))
            macro_prec = float(np.sum(precs))
            macro_rec = float(np.sum(recs))

            metrics_dict = {
                "accuracy": round(acc, 4),
                "precision": round(macro_prec, 4),
                "recall": round(macro_rec, 4),
                "f1": round(macro_f1, 4),
            }

            fitted_pipelines[name] = pipe

            if macro_f1 > best_f1:
                best_f1 = macro_f1
                best_name = name
                best_metrics = metrics_dict
                best_pipeline = pipe

        for name, _ in candidate_models:
            pipe = fitted_pipelines[name]
            y_pred = pipe.predict(X_test)
            acc = float(np.mean(y_test == y_pred))
            is_best = (name == best_name)

            reason = (
                f"{name} selected because it achieved the highest validation F1 score ({best_metrics.get('f1')}) among evaluated candidates."
                if is_best
                else f"Evaluated candidate with validation Accuracy ({round(acc, 4)})."
            )

            evaluated_candidates.append(
                MLModelCandidate(
                    model_name=name,
                    metrics={"accuracy": round(acc, 4)},
                    is_selected=is_best,
                    selection_reason=reason,
                )
            )

        joblib.dump(best_pipeline, artifact_full_path)

        selection_explanation = f"{best_name} selected because it achieved the highest validation F1 score ({best_metrics.get('f1')}) among evaluated candidate models."

        return MLAnalysisResponse(
            id=analysis_id,
            dataset_id=dataset_id,
            task_type="classification",
            target_column=target_col,
            feature_summary=feature_summary,
            feature_columns=features,
            model_name=best_name,
            model_version="1.0",
            training_row_count=len(X_train),
            test_row_count=len(X_test),
            metrics=best_metrics,
            candidate_models=evaluated_candidates,
            status="completed",
            selection_reason=selection_explanation,
            data_warnings=data_warnings,
            model_artifact_path=artifact_rel_path,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def _run_time_series_pipeline(
        cls,
        df: pd.DataFrame,
        target_col: str,
        features: List[str],
        feature_summary: List[MLFeatureInfo],
        analysis_id: str,
        dataset_id: str,
        artifact_full_path: str,
        artifact_rel_path: str,
        data_warnings: List[str],
        roles: List[ColumnRoleInfo],
    ) -> MLAnalysisResponse:
        # Find datetime column
        dt_cols = [r.column for r in roles if r.role == "datetime_dimension"]
        clean_df = df.dropna(subset=[target_col]).copy()
        
        if dt_cols:
            clean_df[dt_cols[0]] = pd.to_datetime(clean_df[dt_cols[0]], errors="coerce")
            clean_df = clean_df.sort_values(by=dt_cols[0]).reset_index(drop=True)

        total_n = len(clean_df)
        train_n = max(int(total_n * 0.8), total_n - 3)
        if train_n < 1:
            train_n = max(1, total_n - 1)

        train_df = clean_df.iloc[:train_n]
        test_df = clean_df.iloc[train_n:]
        if len(test_df) == 0:
            test_df = clean_df.iloc[-1:]

        X_train = train_df[features]
        y_train = train_df[target_col]
        X_test = test_df[features]
        y_test = test_df[target_col]

        candidate_models = [
            ("Naive Last-Value Forecast", TimeSeriesNaiveModel()),
            ("Moving Average (Window=3) Forecast", TimeSeriesMovingAverageModel(window=3)),
        ]

        evaluated_candidates: List[MLModelCandidate] = []
        best_name = ""
        best_rmse = float("inf")
        best_metrics: Dict[str, Optional[float]] = {}
        best_pipeline = None

        for name, model in candidate_models:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            mae = float(np.mean(np.abs(y_test - y_pred)))
            rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))

            metrics_dict = {
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
            }

            if rmse < best_rmse:
                best_rmse = rmse
                best_name = name
                best_metrics = metrics_dict
                best_pipeline = model

            evaluated_candidates.append(
                MLModelCandidate(
                    model_name=name,
                    metrics={"rmse": round(rmse, 4), "mae": round(mae, 4)},
                    is_selected=False,
                    selection_reason=f"Chronological test set RMSE: {round(rmse, 4)}",
                )
            )

        for c in evaluated_candidates:
            if c.model_name == best_name:
                c.is_selected = True
                c.selection_reason = f"{best_name} selected because it achieved the lowest chronological test RMSE ({best_metrics.get('rmse')}) among candidate forecasters."

        joblib.dump(best_pipeline, artifact_full_path)

        selection_explanation = f"{best_name} selected because it achieved the lowest chronological test RMSE ({best_metrics.get('rmse')}) among candidate forecasters."

        return MLAnalysisResponse(
            id=analysis_id,
            dataset_id=dataset_id,
            task_type="time_series_forecasting",
            target_column=target_col,
            feature_summary=feature_summary,
            feature_columns=features,
            model_name=best_name,
            model_version="1.0",
            training_row_count=len(X_train),
            test_row_count=len(X_test),
            metrics=best_metrics,
            candidate_models=evaluated_candidates,
            status="completed",
            selection_reason=selection_explanation,
            data_warnings=data_warnings,
            model_artifact_path=artifact_rel_path,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def _run_anomaly_pipeline(
        cls,
        df: pd.DataFrame,
        features: List[str],
        feature_summary: List[MLFeatureInfo],
        analysis_id: str,
        dataset_id: str,
        artifact_full_path: str,
        artifact_rel_path: str,
        data_warnings: List[str],
    ) -> MLAnalysisResponse:
        X = df[features]
        preprocessor = cls._build_preprocessor(X)

        model = IsolationForest(random_state=42, contamination="auto")
        pipe = Pipeline([
            ("preprocessor", preprocessor),
            ("detector", model),
        ])

        pipe.fit(X)
        preds = pipe.predict(X)  # -1 for anomaly, 1 for normal
        anomalies = np.sum(preds == -1)
        anomaly_pct = (anomalies / len(df)) * 100.0 if len(df) > 0 else 0.0

        metrics_dict = {
            "anomaly_count": int(anomalies),
            "anomaly_percentage": round(float(anomaly_pct), 2),
        }

        joblib.dump(pipe, artifact_full_path)

        candidate = MLModelCandidate(
            model_name="Isolation Forest",
            metrics=metrics_dict,
            is_selected=True,
            selection_reason=f"Isolation Forest identified {anomalies} anomalies ({round(anomaly_pct, 2)}% of dataset).",
        )

        selection_explanation = f"Isolation Forest selected as standard unsupervised statistical anomaly detection model."

        return MLAnalysisResponse(
            id=analysis_id,
            dataset_id=dataset_id,
            task_type="anomaly_detection",
            target_column=None,
            feature_summary=feature_summary,
            feature_columns=features,
            model_name="Isolation Forest",
            model_version="1.0",
            training_row_count=len(df),
            test_row_count=len(df),
            metrics=metrics_dict,
            candidate_models=[candidate],
            status="completed",
            selection_reason=selection_explanation,
            data_warnings=data_warnings,
            model_artifact_path=artifact_rel_path,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def get_analyses_for_dataset(cls, db: Session, dataset_id: str) -> List[MLAnalysisResponse]:
        """Fetch all stored ML analyses for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(MLAnalysis)
            .where(MLAnalysis.dataset_id == target_dataset.id)
            .order_by(MLAnalysis.created_at.desc())
        )
        records = db.scalars(stmt).all()
        responses = []
        for r in records:
            if r.result_data:
                responses.append(MLAnalysisResponse(**r.result_data))
        return responses

    @classmethod
    def get_analysis_by_id(cls, db: Session, dataset_id: str, analysis_id: str) -> MLAnalysisResponse:
        """Fetch single stored ML analysis by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(MLAnalysis).where(
            MLAnalysis.id == analysis_id, MLAnalysis.dataset_id == target_dataset.id
        )
        record = db.scalars(stmt).first()
        if not record or not record.result_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ML Analysis '{analysis_id}' not found for dataset '{dataset_id}'.",
            )
        return MLAnalysisResponse(**record.result_data)

    @classmethod
    def predict(
        cls,
        db: Session,
        dataset_id: str,
        analysis_id: str,
        inputs: List[Dict[str, Any]]
    ) -> PredictionResponse:
        """Load stored model artifact and execute prediction on supplied input records without refitting."""
        analysis_resp = cls.get_analysis_by_id(db=db, dataset_id=dataset_id, analysis_id=analysis_id)
        
        stmt = select(MLAnalysis).where(MLAnalysis.id == analysis_id)
        record = db.scalars(stmt).first()
        if not record or not record.model_artifact_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model artifact for analysis '{analysis_id}' not found.",
            )

        artifact_filename = os.path.basename(record.model_artifact_path)
        artifact_full_path = str(settings.models_dir_path / artifact_filename)
        if not os.path.exists(artifact_full_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model artifact file '{record.model_artifact_path}' missing from storage.",
            )

        if not inputs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prediction inputs cannot be empty. Must contain at least one record.",
            )

        # Load persisted trained pipeline artifact
        model_pipeline = joblib.load(artifact_full_path)

        allowed_features = set(record.feature_columns or [])

        # Identify numeric vs non-numeric feature columns
        numeric_features = set()
        if record.result_data and "feature_summary" in record.result_data:
            for f_info in record.result_data["feature_summary"]:
                if f_info.get("name") in allowed_features and f_info.get("role") == "numeric":
                    numeric_features.add(f_info.get("name"))

        if hasattr(model_pipeline, "named_steps") and "preprocessor" in model_pipeline.named_steps:
            preproc = model_pipeline.named_steps["preprocessor"]
            if hasattr(preproc, "transformers_"):
                for name, trans, cols in preproc.transformers_:
                    if name == "num":
                        numeric_features.update(cols)

        # Strict per-record validation
        for idx, inp in enumerate(inputs):
            if not isinstance(inp, dict) or not inp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Prediction input at index {idx} cannot be empty.",
                )

            # 1. Unknown features check
            unknown_cols = [k for k in inp.keys() if k not in allowed_features]
            if unknown_cols:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Prediction input at index {idx} contains unknown feature columns: {sorted(unknown_cols)}",
                )

            # 2. Required features check (missing keys)
            missing_cols = [f for f in record.feature_columns if f not in inp]
            if missing_cols:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Prediction input at index {idx} is missing required feature columns: {sorted(missing_cols)}",
                )

            # 3. Null / None check
            null_cols = [f for f in record.feature_columns if inp.get(f) is None]
            if null_cols:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Prediction input at index {idx} contains null/missing values for required feature columns: {sorted(null_cols)}",
                )

            # 4. Feature value validation
            for col in record.feature_columns:
                val = inp[col]
                # Reject nested objects or lists
                if isinstance(val, (dict, list, set, tuple)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid value for feature '{col}' at input index {idx}. Nested structures are not allowed.",
                    )

                # Validate numeric features
                if col in numeric_features:
                    if isinstance(val, bool):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid value for numeric feature '{col}' at input index {idx}. Expected number, got boolean.",
                        )
                    if not isinstance(val, (int, float)):
                        if isinstance(val, str):
                            try:
                                fval = float(val)
                                if np.isnan(fval) or np.isinf(fval):
                                    raise ValueError
                            except (ValueError, TypeError):
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Invalid value for numeric feature '{col}' at input index {idx}. Expected number, got '{val}'.",
                                )
                        else:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Invalid value for numeric feature '{col}' at input index {idx}. Expected number.",
                            )

        input_df = pd.DataFrame(inputs)
        X_input = input_df[record.feature_columns]

        # Execute prediction using loaded artifact without refitting
        try:
            predictions = model_pipeline.predict(X_input)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Prediction execution failed due to invalid input feature data: {str(exc)}",
            )

        if isinstance(predictions, np.ndarray):
            pred_list = predictions.tolist()
        else:
            pred_list = list(predictions)

        # Extract probabilities for classification models if available
        probabilities = None
        if record.task_type == "classification" and hasattr(model_pipeline, "predict_proba"):
            try:
                proba = model_pipeline.predict_proba(X_input)
                classes = getattr(model_pipeline, "classes_", None)
                if classes is None and hasattr(model_pipeline, "named_steps"):
                    classifier = model_pipeline.named_steps.get("classifier")
                    if classifier and hasattr(classifier, "classes_"):
                        classes = classifier.classes_

                if proba is not None and classes is not None:
                    probabilities = []
                    for row_proba in proba:
                        prob_dict = {
                            str(cls_name): round(float(p), 4)
                            for cls_name, p in zip(classes, row_proba)
                        }
                        probabilities.append(prob_dict)
            except Exception:
                probabilities = None

        # Format explanation
        explanation = (
            f"Prediction generated using stored model artifact '{record.model_name}' (v{record.model_version}) "
            f"trained on dataset '{dataset_id}' for task '{record.task_type}'."
        )

        return PredictionResponse(
            analysis_id=analysis_id,
            task_type=record.task_type,
            target_column=record.target_column,
            predictions=pred_list,
            probabilities=probabilities,
            explanation=explanation,
        )


