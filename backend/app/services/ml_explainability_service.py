import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple


class MLExplainabilityService:
    """Service for deterministic scikit-learn model feature importance extraction and what-if delta attribution."""

    @classmethod
    def get_model_feature_importances(
        cls,
        model_pipeline: Any,
        feature_columns: List[str]
    ) -> Dict[str, float]:
        """Extract and normalize feature importance weights from a trained scikit-learn pipeline."""
        if not feature_columns:
            return {}

        model = None
        if hasattr(model_pipeline, "named_steps"):
            model = model_pipeline.named_steps.get("model") or model_pipeline.named_steps.get("classifier") or model_pipeline.named_steps.get("regressor")
        else:
            model = model_pipeline

        raw_importances: Optional[np.ndarray] = None

        # 1. Tree-based models (Random Forest, Decision Tree, Gradient Boosting, Extra Trees)
        if hasattr(model, "feature_importances_"):
            raw_importances = model.feature_importances_

        # 2. Linear models (Linear Regression, Logistic Regression, Ridge, Lasso)
        elif hasattr(model, "coef_"):
            coef = model.coef_
            if coef.ndim > 1:
                coef = np.mean(np.abs(coef), axis=0)
            else:
                coef = np.abs(coef)
            raw_importances = coef

        if raw_importances is None or len(raw_importances) == 0:
            # Fallback equal importance
            equal_weight = round(1.0 / len(feature_columns), 4)
            return {col: equal_weight for col in feature_columns}

        # Map importances back to original feature columns
        mapped_importances: Dict[str, float] = {}

        # If preprocessor exists in pipeline, handle column transformer mapping
        preproc = model_pipeline.named_steps.get("preprocessor") if hasattr(model_pipeline, "named_steps") else None
        if preproc and hasattr(preproc, "transformers_"):
            feature_names = []
            for name, trans, cols in preproc.transformers_:
                if name != "remainder":
                    if hasattr(trans, "get_feature_names_out"):
                        try:
                            names = list(trans.get_feature_names_out(cols))
                            feature_names.extend(names)
                        except Exception:
                            feature_names.extend(cols)
                    else:
                        feature_names.extend(cols)

            if len(feature_names) == len(raw_importances):
                # Aggregate encoded columns back to base feature names
                for fname, imp in zip(feature_names, raw_importances):
                    matched_base = None
                    for base_col in feature_columns:
                        if fname.startswith(base_col):
                            matched_base = base_col
                            break
                    if not matched_base:
                        matched_base = feature_columns[0]
                    mapped_importances[matched_base] = mapped_importances.get(matched_base, 0.0) + float(abs(imp))
            else:
                for idx, col in enumerate(feature_columns):
                    imp_val = float(abs(raw_importances[idx])) if idx < len(raw_importances) else 0.0
                    mapped_importances[col] = imp_val
        else:
            for idx, col in enumerate(feature_columns):
                imp_val = float(abs(raw_importances[idx])) if idx < len(raw_importances) else 0.0
                mapped_importances[col] = imp_val

        # Normalize importance values so they sum to 1.0 (100%)
        total_imp = sum(mapped_importances.values())
        if total_imp > 1e-6:
            normalized = {col: round(val / total_imp, 4) for col, val in mapped_importances.items()}
        else:
            equal_weight = round(1.0 / len(feature_columns), 4)
            normalized = {col: equal_weight for col in feature_columns}

        return normalized

    @classmethod
    def explain_scenario_delta(
        cls,
        model_pipeline: Any,
        feature_columns: List[str],
        baseline_record: Dict[str, Any],
        scenario_changes: Dict[str, Any],
        baseline_pred: float,
        scenario_pred: float,
    ) -> Dict[str, Dict[str, Any]]:
        """Compute per-feature marginal contributions to the change between baseline and scenario predictions."""
        contributions: Dict[str, Dict[str, Any]] = {}
        total_delta = scenario_pred - baseline_pred

        # Identify which feature columns were changed in scenario
        changed_features = [col for col in feature_columns if col in scenario_changes and scenario_changes[col] != baseline_record.get(col)]

        if not changed_features:
            for col in feature_columns:
                contributions[col] = {
                    "baseline_value": baseline_record.get(col),
                    "scenario_value": baseline_record.get(col),
                    "changed": False,
                    "marginal_delta": 0.0,
                    "contribution_percentage": 0.0,
                }
            return contributions

        # Compute single-variable substitution predictions to evaluate marginal impact
        marginal_impacts: Dict[str, float] = {}
        for col in changed_features:
            # Construct a hybrid record with ONLY feature `col` modified
            single_change_record = dict(baseline_record)
            single_change_record[col] = scenario_changes[col]

            X_single = pd.DataFrame([single_change_record])[feature_columns]
            try:
                pred_single = float(model_pipeline.predict(X_single)[0])
                marginal_impacts[col] = pred_single - baseline_pred
            except Exception:
                marginal_impacts[col] = 0.0

        sum_marginal = sum(abs(v) for v in marginal_impacts.values())

        for col in feature_columns:
            base_val = baseline_record.get(col)
            scen_val = scenario_changes.get(col, base_val)
            is_changed = col in changed_features

            if is_changed:
                m_delta = marginal_impacts.get(col, 0.0)
                if sum_marginal > 1e-6:
                    contrib_pct = round((abs(m_delta) / sum_marginal) * 100.0, 2)
                else:
                    contrib_pct = round(100.0 / len(changed_features), 2)
            else:
                m_delta = 0.0
                contrib_pct = 0.0

            contributions[col] = {
                "baseline_value": base_val,
                "scenario_value": scen_val,
                "changed": is_changed,
                "marginal_delta": round(m_delta, 4),
                "contribution_percentage": contrib_pct,
            }

        return contributions
