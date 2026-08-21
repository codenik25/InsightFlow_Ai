import pandas as pd
from app.services.type_detector import TypeDetector


def test_detect_identifier_column():
    series = pd.Series(["TXN-001", "TXN-002", "TXN-003", "TXN-004"])
    inferred = TypeDetector.detect_column_type(series, "transaction_id")
    assert inferred == "identifier"


def test_detect_numeric_column():
    series = pd.Series([100, 250, 300, 450, 500])
    inferred = TypeDetector.detect_column_type(series, "total_revenue")
    assert inferred == "numeric"


def test_detect_boolean_column():
    series = pd.Series(["True", "False", "True", "False"])
    inferred = TypeDetector.detect_column_type(series, "is_active")
    assert inferred == "boolean"


def test_detect_datetime_column():
    series = pd.Series(["2026-01-01", "2026-01-02", "2026-01-03"])
    inferred = TypeDetector.detect_column_type(series, "created_at")
    assert inferred == "datetime"


def test_detect_categorical_column():
    series = pd.Series(["North America", "Europe", "Asia", "Europe", "North America"])
    inferred = TypeDetector.detect_column_type(series, "region")
    assert inferred == "categorical"


def test_detect_text_column():
    # High cardinality free text strings
    series = pd.Series([f"Free text note number {i} with detailed comments" for i in range(60)])
    inferred = TypeDetector.detect_column_type(series, "user_notes")
    assert inferred == "text"


def test_detect_identifier_candidates_and_uniqueness():
    # Numeric integer transaction_id with 1 duplicate in 19 rows (high uniqueness > 80%)
    txn_ids = list(range(1001, 1019)) + [1015]
    series_txn = pd.Series(txn_ids)
    assert TypeDetector.detect_column_type(series_txn, "transaction_id") == "identifier"

    # Common identifier names with high uniqueness
    candidate_names = ["id", "user_id", "customer_id", "order_id", "product_id", "transaction_id"]
    for name in candidate_names:
        s = pd.Series([101, 102, 103, 104, 105])
        assert TypeDetector.detect_column_type(s, name) == "identifier"

    # Candidate name with low uniqueness (repetitive categories) should not be identifier
    low_unique = pd.Series(["ORD-1", "ORD-1", "ORD-1", "ORD-2", "ORD-1"])
    assert TypeDetector.detect_column_type(low_unique, "order_id") == "categorical"


def test_preserve_genuine_numeric_columns():
    # Genuine numeric columns should be numeric even if values are distinct
    units = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert TypeDetector.detect_column_type(units, "units_sold") == "numeric"

    price = pd.Series([55000, 65000, 15000, 2500, 1200])
    assert TypeDetector.detect_column_type(price, "unit_price") == "numeric"

    revenue = pd.Series([110000, 65000, 45000, 12500, 12000])
    assert TypeDetector.detect_column_type(revenue, "total_revenue") == "numeric"

