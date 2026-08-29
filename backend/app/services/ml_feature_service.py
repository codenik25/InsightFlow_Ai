from typing import List, Dict, Tuple, Optional
import pandas as pd
import numpy as np
from app.services.type_detector import TypeDetector
from app.schemas.kpi import ColumnRoleInfo
from app.schemas.ml import MLFeatureInfo


class MLFeatureService:
    """Domain-agnostic feature discovery and explainable selection/exclusion service."""

    @classmethod
    def discover_features(
        cls,
        df: pd.DataFrame,
        target_column: Optional[str],
        roles: List[ColumnRoleInfo]
    ) -> List[MLFeatureInfo]:
        """
        Determines useful predictor features for a target column.
        Explains inclusion/exclusion rationale for every dataset column.
        """
        feature_info_list: List[MLFeatureInfo] = []
        role_map: Dict[str, ColumnRoleInfo] = {r.column: r for r in roles}
        total_rows = len(df)

        for col in df.columns:
            col_name = str(col)
            series = df[col]
            clean_s = series.dropna()
            non_null_count = len(clean_s)

            role_info = role_map.get(col_name)
            inferred_type = role_info.inferred_type if role_info else TypeDetector.detect_column_type(series, col_name)

            # 1. Target Column Exclusion
            if target_column and col_name == target_column:
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role=inferred_type,
                        status="excluded",
                        reason="Target column itself (excluded to avoid self-prediction leakage)",
                    )
                )
                continue

            # 2. Complete Missingness or High Missingness (> 30%)
            missing_ratio = (total_rows - non_null_count) / total_rows if total_rows > 0 else 1.0
            if non_null_count == 0 or missing_ratio > 0.30:
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role=inferred_type,
                        status="excluded",
                        reason=f"High missingness ({round(missing_ratio * 100, 1)}% missing values)",
                    )
                )
                continue

            # 3. Free Text Exclusion
            if inferred_type == "text" or (role_info and role_info.role == "text"):
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role="text",
                        status="excluded",
                        reason=f"Unstructured free text column excluded from tabular model features ({clean_s.nunique()} unique values)",
                    )
                )
                continue

            # 4. Datetime Column Exclusion
            if inferred_type == "datetime" or (role_info and role_info.role == "datetime_dimension"):
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role="datetime",
                        status="excluded",
                        reason="Datetime dimension column excluded from tabular predictor features",
                    )
                )
                continue

            # 5. Identifier Exclusion
            is_id_name = TypeDetector.is_identifier_candidate_name(col_name)
            uniqueness_ratio = clean_s.nunique() / non_null_count if non_null_count > 0 else 0.0
            if (role_info and role_info.role == "identifier") or is_id_name or (uniqueness_ratio >= 0.85 and inferred_type not in ["numeric", "datetime", "text"]):
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role="identifier",
                        status="excluded",
                        reason=f"Identifier column with non-predictive high uniqueness ({round(uniqueness_ratio * 100, 1)}%)",
                    )
                )
                continue

            # 5. Zero Variance (Constant Value) Exclusion
            if clean_s.nunique() <= 1:
                feature_info_list.append(
                    MLFeatureInfo(
                        name=col_name,
                        role=inferred_type,
                        status="excluded",
                        reason="Constant single-value feature with 0 variance",
                    )
                )
                continue

            # 6. Valid Predictor Feature
            feature_info_list.append(
                MLFeatureInfo(
                    name=col_name,
                    role=inferred_type,
                    status="included",
                    reason=f"Valid {inferred_type} predictor feature ({clean_s.nunique()} unique values, {round(missing_ratio * 100, 1)}% missing)",
                )
            )

        return feature_info_list
