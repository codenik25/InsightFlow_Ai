import itertools
from typing import List
import pandas as pd
import numpy as np
from app.schemas.kpi import ColumnRoleInfo
from app.schemas.eda import RelationshipMetric, DistributionStats


class RelationshipService:
    """Deterministic bivariate relationship and statistical distribution service."""

    @classmethod
    def evaluate_relationships(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> List[RelationshipMetric]:
        relationships: List[RelationshipMetric] = []
        measures = [r.column for r in roles if r.role == "measure"]

        if len(measures) < 2:
            return relationships

        # Generate unique pairs (max 10 pairs)
        pairs = list(itertools.combinations(measures, 2))[:10]

        for col_a, col_b in pairs:
            sub = df[[col_a, col_b]].dropna().copy()
            sub[col_a] = pd.to_numeric(sub[col_a], errors="coerce")
            sub[col_b] = pd.to_numeric(sub[col_b], errors="coerce")
            sub = sub.dropna()

            if len(sub) < 3:
                continue

            corr_matrix = sub.corr(method="pearson")
            if col_b not in corr_matrix.columns or col_a not in corr_matrix.index:
                continue

            corr_val = float(corr_matrix.loc[col_a, col_b])
            if np.isnan(corr_val):
                continue

            corr_val = round(corr_val, 4)

            # Classify strength
            if corr_val >= 0.7:
                strength = "strong_positive"
            elif corr_val >= 0.3:
                strength = "moderate_positive"
            elif corr_val > -0.3:
                strength = "neutral"
            elif corr_val > -0.7:
                strength = "moderate_negative"
            else:
                strength = "strong_negative"

            relationships.append(
                RelationshipMetric(
                    column_a=col_a,
                    column_b=col_b,
                    correlation=corr_val,
                    strength=strength,
                )
            )

        return relationships

    @classmethod
    def evaluate_distributions(
        cls, df: pd.DataFrame, roles: List[ColumnRoleInfo]
    ) -> List[DistributionStats]:
        distributions: List[DistributionStats] = []
        measures = [r.column for r in roles if r.role == "measure"]

        for col in measures:
            clean_s = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(clean_s) == 0:
                continue

            min_val = float(clean_s.min())
            max_val = float(clean_s.max())
            mean_val = float(clean_s.mean())
            median_val = float(clean_s.median())
            std_val = float(clean_s.std()) if len(clean_s) > 1 else 0.0

            q25 = float(clean_s.quantile(0.25))
            q50 = median_val
            q75 = float(clean_s.quantile(0.75))
            iqr_val = round(q75 - q25, 4)

            skew_val = float(clean_s.skew()) if len(clean_s) > 2 else 0.0
            if np.isnan(skew_val):
                skew_val = 0.0

            zero_cnt = int((clean_s == 0).sum())
            is_const = bool(clean_s.nunique() == 1)

            distributions.append(
                DistributionStats(
                    column=col,
                    min=round(min_val, 4),
                    max=round(max_val, 4),
                    mean=round(mean_val, 4),
                    median=round(median_val, 4),
                    std=round(std_val, 4),
                    p25=round(q25, 4),
                    p50=round(q50, 4),
                    p75=round(q75, 4),
                    iqr=iqr_val,
                    skewness=round(skew_val, 4),
                    zero_count=zero_cnt,
                    is_constant=is_const,
                )
            )

        return distributions
