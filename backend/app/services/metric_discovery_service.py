from typing import List, Dict
import pandas as pd
from app.services.type_detector import TypeDetector
from app.schemas.kpi import ColumnRoleInfo


class MetricDiscoveryService:
    """Deterministic, domain-agnostic column role classifier."""

    @classmethod
    def discover_column_roles(cls, df: pd.DataFrame) -> List[ColumnRoleInfo]:
        roles: List[ColumnRoleInfo] = []
        total_rows = len(df)

        for col in df.columns:
            col_name = str(col)
            series = df[col]
            clean_s = series.dropna()
            non_null_count = len(clean_s)

            if non_null_count == 0:
                roles.append(
                    ColumnRoleInfo(
                        column=col_name,
                        role="text",
                        reason="Column contains 100% missing values",
                        inferred_type="text",
                    )
                )
                continue

            inferred_type = TypeDetector.detect_column_type(series, col_name)
            unique_count = clean_s.nunique()
            uniqueness_ratio = unique_count / non_null_count if non_null_count > 0 else 0.0

            # 1. Identifier Role
            if inferred_type == "identifier":
                roles.append(
                    ColumnRoleInfo(
                        column=col_name,
                        role="identifier",
                        reason=f"Matches identifier pattern or has high uniqueness ({round(uniqueness_ratio*100, 1)}%)",
                        inferred_type=inferred_type,
                    )
                )
                continue

            # 2. Datetime Dimension Role
            if inferred_type == "datetime":
                roles.append(
                    ColumnRoleInfo(
                        column=col_name,
                        role="datetime_dimension",
                        reason="Time-series date/timestamp column",
                        inferred_type=inferred_type,
                    )
                )
                continue

            # 3. Boolean Role
            if inferred_type == "boolean":
                roles.append(
                    ColumnRoleInfo(
                        column=col_name,
                        role="boolean",
                        reason="Binary boolean logical flag",
                        inferred_type=inferred_type,
                    )
                )
                continue

            # 4. Measure Role (Numeric continuous values)
            if inferred_type == "numeric":
                # Check if it's a candidate key/ID mistakenly classified or low cardinality numeric
                if TypeDetector.is_identifier_candidate_name(col_name) and uniqueness_ratio >= 0.8:
                    roles.append(
                        ColumnRoleInfo(
                            column=col_name,
                            role="identifier",
                            reason=f"Identifier candidate column with high uniqueness ratio ({round(uniqueness_ratio*100, 1)}%)",
                            inferred_type="identifier",
                        )
                    )
                else:
                    roles.append(
                        ColumnRoleInfo(
                            column=col_name,
                            role="measure",
                            reason="Numeric column with continuous metric distribution",
                            inferred_type=inferred_type,
                        )
                    )
                continue

            # 5. Categorical Dimension Role
            if inferred_type == "categorical" or unique_count <= 50 or (uniqueness_ratio <= 0.3 and total_rows > 10):
                roles.append(
                    ColumnRoleInfo(
                        column=col_name,
                        role="categorical_dimension",
                        reason=f"Discrete category column with {unique_count} distinct values",
                        inferred_type="categorical",
                    )
                )
                continue

            # 6. Text Role (Free text / high cardinality strings)
            roles.append(
                ColumnRoleInfo(
                    column=col_name,
                    role="text",
                    reason=f"Unstructured free text string with high cardinality ({unique_count} unique values)",
                    inferred_type="text",
                )
            )

        return roles
