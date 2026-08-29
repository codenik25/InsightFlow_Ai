import pandas as pd
from app.services.quality_service import QualityService


def test_quality_service_dirty_dataset():
    data = {
        "transaction_id": list(range(1001, 1016)) + [1015] + list(range(1017, 1019)) + [1015],
        "region": ["Jaipur", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Mumbai", "Delhi", "Delhi", "Jaipur", None, "Delhi"],
        "units_sold": [2, 1, 3, 5, 10, 1, 2, 4, 6, 8, 2, 2, 1, 4, 12, 12, 2, None, 3],
        "unit_price": [55000, 65000, 15000, 2500, 1200, 55000, 72000, 18000, 3000, 1500, 65000, 15000, 72000, 2500, 1200, 1200, 58000, 60000, None],
        "total_revenue": [110000, 65000, 45000, 12500, 12000, 55000, 144000, 72000, 18000, 12000, 130000, 30000, 72000, 10000, 14400, 14400, None, 120000, 45000],
    }
    df = pd.DataFrame(data)
    res = QualityService.evaluate_quality(df, "test-dirty-id")

    assert res.completeness.total_missing_cells == 4
    assert res.uniqueness.duplicate_rows == 1
    assert res.score.overall_score > 0
    assert res.score.completeness_score < 100
    assert res.score.uniqueness_score < 100
    assert res.score.severity in ["Excellent", "Good", "Fair", "Poor", "Critical"]


def test_quality_service_clean_dataset():
    data = {
        "transaction_id": [101, 102, 103, 104, 105],
        "units_sold": [1, 2, 3, 4, 5],
        "price": [10.0, 20.0, 30.0, 40.0, 50.0],
    }
    df = pd.DataFrame(data)
    res = QualityService.evaluate_quality(df, "test-clean-id")

    assert res.completeness.total_missing_cells == 0
    assert res.uniqueness.duplicate_rows == 0
    assert res.score.overall_score == 100
    assert res.score.severity == "Excellent"


def test_quality_service_consistency_and_validity():
    data = {
        "user_id": [1, 2, 3, 4],
        "city": [" Jaipur ", "jaipur", "Jaipur", "Delhi"],
        "age": [25, 30, "invalid_num", 40],
    }
    df = pd.DataFrame(data)
    res = QualityService.evaluate_quality(df, "test-consistency-id")

    assert res.consistency.whitespace_issues_count >= 1
    assert res.consistency.whitespace_issues_count >= 1
    assert res.validity.total_invalid_cells >= 1
    assert res.score.validity_score < 100
    assert res.score.consistency_score < 100


def test_quality_service_semantic_domain_range_validations():
    """Verify semantic domain range validation for occupancy_rate, readmission_rate, patient_satisfaction, average_bill."""
    data = {
        "hospital": ["Hospital A", "Hospital B", "Hospital C"],
        "occupancy_rate": [0.85, 1.35, 0.90],          # 1.35 > 1.0 (invalid)
        "readmission_rate": [0.05, 0.08, 1.40],        # 1.40 > 1.0 (invalid)
        "patient_satisfaction": [85.0, 140.0, 92.0],   # 140.0 > 100.0 (invalid)
        "average_bill": [4500.0, -500.0, 3200.0],      # -500.0 < 0.0 (invalid)
    }
    df = pd.DataFrame(data)
    res = QualityService.evaluate_quality(df, "test-semantic-id")

    # Verify 4 invalid cells detected across 4 columns
    assert res.validity.total_invalid_cells == 4
    assert res.validity.invalid_by_column["occupancy_rate"] == 1
    assert res.validity.invalid_by_column["readmission_rate"] == 1
    assert res.validity.invalid_by_column["patient_satisfaction"] == 1
    assert res.validity.invalid_by_column["average_bill"] == 1

    # Verify issues severity & descriptions
    validity_issues = [i for i in res.issues if i.category == "validity"]
    assert len(validity_issues) == 4
    for issue in validity_issues:
        assert issue.severity == "critical"
        assert "failing semantic range validation" in issue.description

    # Verify validity score and overall score are penalized and severity is not Excellent
    assert res.score.validity_score < 100
    assert res.score.overall_score < 100
    assert res.score.severity != "Excellent"


def test_quality_service_critical_issue_severity_capping():
    """Verify that datasets with critical validity issues cannot get an Excellent severity."""
    data = {
        "patient_id": list(range(1, 101)),
        "average_bill": [4500.0] * 99 + [-100.0],  # 1 critical negative bill
    }
    df = pd.DataFrame(data)
    res = QualityService.evaluate_quality(df, "test-critical-cap-id")

    assert res.validity.total_invalid_cells == 1
    assert any(i.severity == "critical" for i in res.issues)
    assert res.score.severity != "Excellent"
    assert res.score.severity in ["Good", "Fair", "Poor", "Critical"]

