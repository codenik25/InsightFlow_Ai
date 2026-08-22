import pandas as pd
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.trend_service import TrendService


def test_trend_service_increasing_trend():
    dates = pd.date_range(start="2026-08-01", periods=10, freq="D")
    data = {
        "date": dates,
        "revenue": [100 + i * 20 for i in range(10)],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    trends = TrendService.evaluate_trends(df, roles)
    assert len(trends) == 1
    t = trends[0]
    assert t.measure == "revenue"
    assert t.datetime_column == "date"
    assert t.trend_direction == "increasing"
    assert t.pct_change > 0
    assert len(t.time_series) == 10


def test_trend_service_insufficient_data():
    data = {
        "date": ["2026-08-01"],
        "revenue": [500.0],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    trends = TrendService.evaluate_trends(df, roles)
    assert len(trends) == 0
