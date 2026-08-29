from typing import Dict, List, Any
import pandas as pd
import numpy as np
from app.services.type_detector import TypeDetector
from app.schemas.quality import (
    CompletenessMetrics,
    UniquenessMetrics,
    ValidityMetrics,
    ConsistencyMetrics,
    StructuralMetrics,
    QualityScore,
    DatasetQualityResponse,
    IssueDetail,
)


class QualityService:
    """Deterministic, explainable data quality and health engine."""

    SEMANTIC_RANGE_RULES = [
        {
            "keywords": ["occupancy_rate", "occupancy_pct", "occupancy_ratio"],
            "min": 0.0,
            "max": 1.0,
            "description": "Occupancy rate ratio must be between 0.0 and 1.0 (0% - 100%).",
        },
        {
            "keywords": ["readmission_rate", "readmission_pct", "readmission_ratio"],
            "min": 0.0,
            "max": 1.0,
            "description": "Readmission rate ratio must be between 0.0 and 1.0 (0% - 100%).",
        },
        {
            "keywords": ["patient_satisfaction", "satisfaction_score", "satisfaction_pct"],
            "min": 0.0,
            "max": 100.0,
            "description": "Patient satisfaction score must be between 0 and 100.",
        },
        {
            "keywords": ["average_bill", "unit_price", "total_revenue", "operating_cost", "patient_visits", "staff_count", "cost", "expense", "price", "revenue", "sales", "salary", "profit"],
            "min": 0.0,
            "max": None,
            "description": "Business measure value cannot be negative.",
        },
    ]

    @classmethod
    def evaluate_quality(cls, df: pd.DataFrame, dataset_id: str) -> DatasetQualityResponse:
        total_rows = len(df)
        total_cols = len(df.columns)
        total_cells = total_rows * total_cols

        if total_rows == 0 or total_cols == 0:
            # Fallback for empty dataframe
            score = QualityScore(
                overall_score=0,
                completeness_score=0,
                uniqueness_score=0,
                validity_score=0,
                consistency_score=0,
                structural_score=0,
                total_issue_count=1,
                severity="Critical",
            )
            return DatasetQualityResponse(
                dataset_id=dataset_id,
                score=score,
                completeness=CompletenessMetrics(total_missing_cells=0, missing_percentage=0.0),
                uniqueness=UniquenessMetrics(duplicate_rows=0, duplicate_row_percentage=0.0),
                validity=ValidityMetrics(total_invalid_cells=0, invalid_percentage=0.0),
                consistency=ConsistencyMetrics(whitespace_issues_count=0, casing_inconsistencies_count=0),
                structural=StructuralMetrics(),
                issues=[IssueDetail(category="structural", severity="critical", description="Dataset is completely empty.")],
            )

        issues: List[IssueDetail] = []

        # 1. COMPLETENESS EVALUATION
        missing_by_col: Dict[str, int] = {}
        total_missing_cells = 0

        for col in df.columns:
            col_name = str(col)
            null_cnt = int(df[col].isna().sum())
            if null_cnt > 0:
                missing_by_col[col_name] = null_cnt
                total_missing_cells += null_cnt
                issues.append(IssueDetail(
                    category="completeness",
                    severity="warning",
                    description=f"Column '{col_name}' has {null_cnt} missing values ({round(null_cnt/total_rows*100, 1)}%).",
                    column=col_name,
                    count=null_cnt,
                ))

        missing_percentage = round((total_missing_cells / total_cells) * 100.0, 2)

        # 2. UNIQUENESS EVALUATION
        duplicate_rows = int(df.duplicated().sum())
        duplicate_row_pct = round((duplicate_rows / total_rows) * 100.0, 2)
        if duplicate_rows > 0:
            issues.append(IssueDetail(
                category="uniqueness",
                severity="warning",
                description=f"Dataset contains {duplicate_rows} duplicate rows ({duplicate_row_pct}%).",
                count=duplicate_rows,
            ))

        identifier_duplicates: Dict[str, int] = {}
        for col in df.columns:
            col_name = str(col)
            if TypeDetector.is_identifier_candidate_name(col_name):
                clean_s = df[col].dropna()
                dups = int(clean_s.duplicated().sum())
                if dups > 0:
                    identifier_duplicates[col_name] = dups
                    issues.append(IssueDetail(
                        category="uniqueness",
                        severity="warning",
                        description=f"Identifier candidate column '{col_name}' contains {dups} non-unique values.",
                        column=col_name,
                        count=dups,
                    ))

        # 3. VALIDITY EVALUATION
        invalid_by_col: Dict[str, int] = {}
        total_invalid_cells = 0

        for col in df.columns:
            col_name = str(col)
            series = df[col]
            clean_s = series.dropna()
            if len(clean_s) == 0:
                continue

            inferred_type = TypeDetector.detect_column_type(series, col_name)

            # Type validity checking
            if inferred_type == 'numeric':
                converted = pd.to_numeric(clean_s, errors='coerce')
                parse_invalid_cnt = int(converted.isna().sum())
                if parse_invalid_cnt > 0:
                    invalid_by_col[col_name] = invalid_by_col.get(col_name, 0) + parse_invalid_cnt
                    total_invalid_cells += parse_invalid_cnt
                    issues.append(IssueDetail(
                        category="validity",
                        severity="critical",
                        description=f"Column '{col_name}' has {parse_invalid_cnt} values failing numeric parsing.",
                        column=col_name,
                        count=parse_invalid_cnt,
                    ))

                # Semantic / Domain range validation for valid numeric values
                valid_num_s = converted.dropna()
                col_lower = col_name.lower().replace('-', '_')

                for rule in cls.SEMANTIC_RANGE_RULES:
                    if any(kw == col_lower or kw in col_lower for kw in rule["keywords"]):
                        domain_invalid_cnt = 0
                        invalid_samples = []

                        if rule["min"] is not None:
                            below_min = valid_num_s[valid_num_s < rule["min"]]
                            if len(below_min) > 0:
                                domain_invalid_cnt += len(below_min)
                                invalid_samples.extend([str(v) for v in below_min.iloc[:3]])

                        if rule["max"] is not None:
                            above_max = valid_num_s[valid_num_s > rule["max"]]
                            if len(above_max) > 0:
                                domain_invalid_cnt += len(above_max)
                                invalid_samples.extend([str(v) for v in above_max.iloc[:3]])

                        if domain_invalid_cnt > 0:
                            invalid_by_col[col_name] = invalid_by_col.get(col_name, 0) + domain_invalid_cnt
                            total_invalid_cells += domain_invalid_cnt
                            sample_str = f" (observed: {', '.join(invalid_samples)})" if invalid_samples else ""
                            issues.append(IssueDetail(
                                category="validity",
                                severity="critical",
                                description=f"Column '{col_name}' has {domain_invalid_cnt} values failing semantic range validation ({rule['description']}){sample_str}.",
                                column=col_name,
                                count=domain_invalid_cnt,
                            ))

            elif inferred_type == 'datetime':
                converted = pd.to_datetime(clean_s, errors='coerce')
                invalid_cnt = int(converted.isna().sum())
                if invalid_cnt > 0:
                    invalid_by_col[col_name] = invalid_cnt
                    total_invalid_cells += invalid_cnt
                    issues.append(IssueDetail(
                        category="validity",
                        severity="critical",
                        description=f"Column '{col_name}' has {invalid_cnt} values failing datetime parsing.",
                        column=col_name,
                        count=invalid_cnt,
                    ))

        invalid_percentage = round((total_invalid_cells / total_cells) * 100.0, 2)

        # 4. CONSISTENCY EVALUATION
        whitespace_cnt = 0
        casing_cnt = 0
        inconsistent_cols: List[str] = []

        for col in df.columns:
            col_name = str(col)
            series = df[col]
            # Check for strings
            str_s = series.dropna().astype(str)
            col_ws_issues = 0
            for val in str_s:
                if val != val.strip():
                    col_ws_issues += 1
            if col_ws_issues > 0:
                whitespace_cnt += col_ws_issues
                if col_name not in inconsistent_cols:
                    inconsistent_cols.append(col_name)
                issues.append(IssueDetail(
                    category="consistency",
                    severity="info",
                    description=f"Column '{col_name}' has {col_ws_issues} values with leading/trailing whitespace.",
                    column=col_name,
                    count=col_ws_issues,
                ))

            # Check casing inconsistency for non-numeric/non-id strings
            if TypeDetector.detect_column_type(series, col_name) in ('categorical', 'text'):
                unique_orig = set(str_s.unique())
                unique_lower = set(str_s.str.lower().unique())
                if len(unique_orig) > len(unique_lower):
                    col_case_diff = len(unique_orig) - len(unique_lower)
                    casing_cnt += col_case_diff
                    if col_name not in inconsistent_cols:
                        inconsistent_cols.append(col_name)
                    issues.append(IssueDetail(
                        category="consistency",
                        severity="info",
                        description=f"Column '{col_name}' has inconsistent casing across categorical values.",
                        column=col_name,
                        count=col_case_diff,
                    ))

        # 5. STRUCTURAL EVALUATION
        empty_cols: List[str] = []
        constant_cols: List[str] = []
        dup_cols: List[str] = []

        col_name_counts: Dict[str, int] = {}
        for col in df.columns:
            c = str(col)
            col_name_counts[c] = col_name_counts.get(c, 0) + 1

        for c, count in col_name_counts.items():
            if count > 1:
                dup_cols.append(c)
                issues.append(IssueDetail(
                    category="structural",
                    severity="warning",
                    description=f"Duplicate column name '{c}' appears {count} times.",
                    column=c,
                    count=count,
                ))

        for col in df.columns:
            col_name = str(col)
            clean_s = df[col].dropna()
            if len(clean_s) == 0:
                empty_cols.append(col_name)
                issues.append(IssueDetail(
                    category="structural",
                    severity="warning",
                    description=f"Column '{col_name}' is completely empty (100% missing).",
                    column=col_name,
                    count=total_rows,
                ))
            elif clean_s.nunique() == 1:
                constant_cols.append(col_name)
                issues.append(IssueDetail(
                    category="structural",
                    severity="info",
                    description=f"Column '{col_name}' has constant value ('{clean_s.iloc[0]}').",
                    column=col_name,
                    count=len(clean_s),
                ))

        # CALCULATE SCORES (0 to 100)
        completeness_penalty = (total_missing_cells / total_cells * 100.0) + (len(missing_by_col) * 2.0)
        completeness_score = max(0, min(100, round(100.0 - completeness_penalty)))

        uniqueness_penalty = (duplicate_rows / total_rows * 100.0) + (min(duplicate_rows, 20) * 1.0) + (len(identifier_duplicates) * 5.0)
        uniqueness_score = max(0, min(100, round(100.0 - uniqueness_penalty)))

        validity_penalty = (total_invalid_cells / total_cells * 100.0) + (len(invalid_by_col) * 3.0) + (total_invalid_cells * 1.5)
        validity_score = max(0, min(100, round(100.0 - validity_penalty)))

        consistency_penalty = ((whitespace_cnt + casing_cnt) / total_cells * 100.0) + (len(inconsistent_cols) * 1.5)
        consistency_score = max(0, min(100, round(100.0 - consistency_penalty)))

        structural_penalty = ((len(empty_cols) * 50.0 + len(constant_cols) * 20.0 + len(dup_cols) * 50.0) / total_cols * 100.0)
        structural_score = max(0, min(100, round(100.0 - structural_penalty)))

        raw_overall = (
            0.30 * completeness_score
            + 0.20 * uniqueness_score
            + 0.25 * validity_score
            + 0.15 * consistency_score
            + 0.10 * structural_score
        )
        overall_score = max(0, min(100, round(raw_overall)))

        has_critical_issues = any(i.severity == "critical" for i in issues)

        if overall_score >= 90:
            severity = "Good" if has_critical_issues else "Excellent"
        elif overall_score >= 80:
            severity = "Good" if not has_critical_issues or validity_score >= 80 else "Fair"
        elif overall_score >= 60:
            severity = "Fair"
        elif overall_score >= 40:
            severity = "Poor"
        else:
            severity = "Critical"

        score = QualityScore(
            overall_score=overall_score,
            completeness_score=completeness_score,
            uniqueness_score=uniqueness_score,
            validity_score=validity_score,
            consistency_score=consistency_score,
            structural_score=structural_score,
            total_issue_count=len(issues),
            severity=severity,
        )

        return DatasetQualityResponse(
            dataset_id=dataset_id,
            score=score,
            completeness=CompletenessMetrics(
                total_missing_cells=total_missing_cells,
                missing_percentage=missing_percentage,
                missing_by_column=missing_by_col,
            ),
            uniqueness=UniquenessMetrics(
                duplicate_rows=duplicate_rows,
                duplicate_row_percentage=duplicate_row_pct,
                identifier_duplicates=identifier_duplicates,
            ),
            validity=ValidityMetrics(
                total_invalid_cells=total_invalid_cells,
                invalid_percentage=invalid_percentage,
                invalid_by_column=invalid_by_col,
            ),
            consistency=ConsistencyMetrics(
                whitespace_issues_count=whitespace_cnt,
                casing_inconsistencies_count=casing_cnt,
                inconsistent_columns=inconsistent_cols,
            ),
            structural=StructuralMetrics(
                empty_columns=empty_cols,
                constant_columns=constant_cols,
                duplicate_column_names=dup_cols,
            ),
            issues=issues,
        )
