import pandas as pd
import pytest
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.ml_feature_service import MLFeatureService


def test_feature_discovery_and_exclusion():
    data = {
        "transaction_id": [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
        "units_sold": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "unit_price": [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],  # zero variance
        "total_revenue": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
        "all_missing": [None] * 10,
        "region": ["East", "West", "North", "South", "East", "West", "North", "South", "East", "West"],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    feature_info = MLFeatureService.discover_features(df, target_column="total_revenue", roles=roles)

    feature_map = {f.name: f for f in feature_info}

    # 1. Target column excluded
    assert feature_map["total_revenue"].status == "excluded"
    assert "Target column itself" in feature_map["total_revenue"].reason

    # 2. Identifier excluded
    assert feature_map["transaction_id"].status == "excluded"
    assert "Identifier column" in feature_map["transaction_id"].reason

    # 3. All missing excluded
    assert feature_map["all_missing"].status == "excluded"
    assert "High missingness" in feature_map["all_missing"].reason

    # 4. Zero variance excluded
    assert feature_map["unit_price"].status == "excluded"
    assert "Constant single-value feature" in feature_map["unit_price"].reason

    # 5. Predictors included
    assert feature_map["units_sold"].status == "included"
    assert feature_map["region"].status == "included"
