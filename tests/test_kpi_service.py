import pandas as pd
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.kpi_service import KPIService


def test_metric_suitability_price_no_sum_kpi():
    """Price-like columns must NOT receive a Total/Sum KPI by default."""
    data = {
        "item_id": [1, 2, 3, 4, 5],
        "category": ["Electronics", "Electronics", "Accessories", "Accessories", "Electronics"],
        "unit_price": [50000.0, 60000.0, 2500.0, 3000.0, 55000.0],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    kpis = KPIService.discover_measure_kpis(df, roles)
    names = [k.name for k in kpis]

    # Verify Total Unit Price is NOT present
    assert "Total Unit Price" not in names
    assert "Average Unit Price" in names
    assert "Median Unit Price" in names
    assert "Min Unit Price" in names
    assert "Max Unit Price" in names
    assert "Std Dev Unit Price" in names

    avg_kpi = next(k for k in kpis if k.name == "Average Unit Price")
    assert avg_kpi.metric_type == "mean"
    assert avg_kpi.format == "number"  # Neutral numeric format (no hardcoded $)
    assert "Price/rate-like measure" in avg_kpi.reason


def test_metric_suitability_amount_and_quantity_receive_sum():
    """Amount and quantity columns MUST receive Total/Sum KPIs."""
    data = {
        "item_id": [1, 2, 3, 4, 5],
        "units_sold": [2, 1, 5, 10, 3],
        "total_revenue": [100000.0, 60000.0, 12500.0, 30000.0, 165000.0],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    kpis = KPIService.discover_measure_kpis(df, roles)
    names = [k.name for k in kpis]

    assert "Total Units Sold" in names
    assert "Total Revenue" in names

    units_sum = next(k for k in kpis if k.name == "Total Units Sold")
    assert units_sum.value == 21
    assert units_sum.format == "integer"
    assert "Count/quantity-like measure" in units_sum.reason

    rev_sum = next(k for k in kpis if k.name == "Total Revenue")
    assert rev_sum.value == 367500.0
    assert rev_sum.format == "number"
    assert "Amount/value-like measure" in rev_sum.reason


def test_grouped_analysis_metric_suitability():
    """Grouped analysis uses average for price measures and sum for amount/quantity measures."""
    data = {
        "category": ["A", "A", "B", "B"],
        "unit_price": [10.0, 20.0, 100.0, 200.0],
        "total_revenue": [10.0, 20.0, 100.0, 200.0],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    breakdowns = KPIService.discover_category_breakdowns(df, roles)
    breakdown_map = {b.measure: b for b in breakdowns}

    # Price breakdown must use 'mean' aggregation and set contribution_pct to 0.0
    price_bd = breakdown_map["unit_price"]
    assert price_bd.aggregation_method == "mean"
    assert price_bd.top_category.category_value == "B"
    assert price_bd.top_category.metric_value == 150.0  # Average of 100 & 200
    assert price_bd.top_category.contribution_pct == 0.0

    # Revenue breakdown must use 'sum' aggregation and compute real contribution_pct
    rev_bd = breakdown_map["total_revenue"]
    assert rev_bd.aggregation_method == "sum"
    assert rev_bd.top_category.category_value == "B"
    assert rev_bd.top_category.metric_value == 300.0  # Sum of 100 & 200
    assert rev_bd.top_category.contribution_pct > 0.0


def test_neutral_currency_formatting():
    """Currency format is neutral numeric without hardcoded dollar or currency symbols."""
    data = {
        "revenue": [1000.0, 2000.0, 3000.0],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    kpis = KPIService.discover_measure_kpis(df, roles)
    for kpi in kpis:
        assert kpi.format in ("number", "integer")
        assert "$" not in str(kpi.value)
