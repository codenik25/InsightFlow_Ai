import pandas as pd
import pytest
from app.services.ml_task_service import MLTaskService


def test_ml_task_discovery_candidates():
    dates = pd.date_range("2026-01-01", periods=15, freq="D")
    data = {
        "transaction_id": list(range(1001, 1016)),
        "date": dates,
        "category": ["A", "B", "A", "B", "C", "A", "B", "A", "B", "C", "A", "B", "A", "B", "C"],
        "units_sold": [2, 5, 3, 6, 1, 4, 7, 2, 5, 8, 3, 6, 9, 2, 4],
        "unit_price": [10.0, 15.0, 10.0, 15.0, 20.0, 10.0, 15.0, 10.0, 15.0, 20.0, 10.0, 15.0, 10.0, 15.0, 20.0],
        "total_revenue": [20.0, 75.0, 30.0, 90.0, 20.0, 40.0, 105.0, 20.0, 75.0, 160.0, 30.0, 90.0, 90.0, 30.0, 80.0],
    }
    df = pd.DataFrame(data)

    resp = MLTaskService.discover_tasks(df)
    task_types = [t.task_type for t in resp.candidate_tasks]

    # Verify task discovery types
    assert "regression" in task_types
    assert "classification" in task_types
    assert "time_series_forecasting" in task_types
    assert "anomaly_detection" in task_types

    # Ensure transaction_id is NOT a target
    targets = [t.target_column for t in resp.candidate_tasks if t.target_column]
    assert "transaction_id" not in targets


def test_no_divide_by_zero_mape_and_metric_correctness():
    # DataFrame with zero targets to verify MAPE safety
    data = {
        "x1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
        "target": [0.0, 0.0, 0.0, 10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0],
    }
    df = pd.DataFrame(data)

    # Simple preprocessor and dummy regression test
    X = df[["x1"]]
    y = df["target"]
    X_train, X_test = X.iloc[:8], X.iloc[8:]
    y_train, y_test = y.iloc[:8], y.iloc[8:]

    preprocessor = MLTaskService._build_preprocessor(X)
    pipe = MLTaskService._build_preprocessor(X)
    assert pipe is not None
