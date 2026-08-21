import pandas as pd
from app.services.profiling_service import ProfilingService


def test_profiling_numeric_and_quality():
    data = {
        "id": ["1", "2", "3", "4", "5"],
        "price": [10.0, 20.0, 30.0, None, 50.0],
        "category": ["A", "B", "A", "B", "A"],
        "empty_col": [None, None, None, None, None],
        "constant_col": ["Fixed", "Fixed", "Fixed", "Fixed", "Fixed"],
    }
    df = pd.DataFrame(data)
    profile = ProfilingService.profile_dataframe(df, "test-id-1", "test.csv", 1024)

    assert profile.overview.total_rows == 5
    assert profile.overview.total_columns == 5
    assert profile.quality.empty_columns == ["empty_col"]
    assert profile.quality.constant_columns == ["constant_col"]

    price_col = next(c for c in profile.columns if c.name == "price")
    assert price_col.null_count == 1
    assert price_col.numeric_stats is not None
    assert price_col.numeric_stats.min == 10.0
    assert price_col.numeric_stats.max == 50.0
    assert price_col.numeric_stats.mean == 27.5


def test_profiling_duplicate_rows():
    data = {
        "user": ["Alice", "Bob", "Alice"],
        "age": [30, 25, 30],
    }
    df = pd.DataFrame(data)
    profile = ProfilingService.profile_dataframe(df, "test-id-2", "dup.csv", 512)

    assert profile.overview.duplicate_rows == 1
    assert profile.quality.duplicate_row_count == 1
    assert profile.quality.duplicate_row_percentage == 33.33


def test_profiling_datetime():
    data = {
        "date": ["2026-01-01", "2026-01-10", "2026-01-20"],
    }
    df = pd.DataFrame(data)
    profile = ProfilingService.profile_dataframe(df, "test-id-3", "dates.csv", 256)

    date_col = profile.columns[0]
    assert date_col.inferred_type == "datetime"
    assert date_col.datetime_stats is not None
    assert "2026-01-01" in date_col.datetime_stats.min_date
    assert date_col.datetime_stats.date_range_days == 19.0


def test_profiling_identifier_stats_exclusion():
    # Load test_phase1_dirty data or similar dataframe with transaction_id
    data = {
        "transaction_id": list(range(1001, 1019)) + [1015],
        "units_sold": [2, 1, 3, 5, 10, 1, 2, 4, 6, 8, 2, 2, 1, 4, 12, 12, 2, 3, 3],
        "unit_price": [55000, 65000, 15000, 2500, 1200, 55000, 72000, 18000, 3000, 1500, 65000, 15000, 72000, 2500, 1200, 1200, 58000, 60000, 15000],
    }
    df = pd.DataFrame(data)
    profile = ProfilingService.profile_dataframe(df, "test-sales-1", "sales.csv", 2048)

    txn_col = next(c for c in profile.columns if c.name == "transaction_id")
    assert txn_col.inferred_type == "identifier"
    assert txn_col.numeric_stats is None
    assert txn_col.categorical_stats is not None

    units_col = next(c for c in profile.columns if c.name == "units_sold")
    assert units_col.inferred_type == "numeric"
    assert units_col.numeric_stats is not None

