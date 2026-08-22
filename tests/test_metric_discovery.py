import pandas as pd
from app.services.metric_discovery_service import MetricDiscoveryService


def test_metric_discovery_sales_domain():
    data = {
        "transaction_id": [f"TXN-{100+i}" for i in range(20)],
        "date": [f"2026-08-{i+1:02d}" for i in range(20)],
        "product": ["Laptop A" if i % 2 == 0 else "Mouse B" for i in range(20)],
        "category": ["Electronics" if i % 2 == 0 else "Accessories" for i in range(20)],
        "region": ["Jaipur", "Delhi", "Mumbai", "Chennai"][::1] * 5,
        "units_sold": [1, 2, 3, 4, 5, 2, 3, 4, 1, 2, 3, 4, 5, 2, 3, 4, 1, 2, 3, 4],
        "total_revenue": [100.0 * (i + 1) for i in range(20)],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)
    role_dict = {r.column: r.role for r in roles}

    assert role_dict["transaction_id"] == "identifier"
    assert role_dict["date"] == "datetime_dimension"
    assert role_dict["product"] == "categorical_dimension"
    assert role_dict["category"] == "categorical_dimension"
    assert role_dict["region"] == "categorical_dimension"
    assert role_dict["units_sold"] == "measure"
    assert role_dict["total_revenue"] == "measure"


def test_metric_discovery_hr_domain():
    data = {
        "employee_id": [f"EMP-{500+i}" for i in range(15)],
        "department": ["Engineering", "HR", "Sales", "Finance", "Engineering"] * 3,
        "salary": [60000, 75000, 50000, 90000, 85000] * 3,
        "joining_date": ["2023-01-15", "2022-05-10", "2024-03-01", "2021-11-20", "2023-08-01"] * 3,
        "performance_score": [4.2, 3.8, 4.5, 4.9, 3.5] * 3,
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)
    role_dict = {r.column: r.role for r in roles}

    assert role_dict["employee_id"] == "identifier"
    assert role_dict["department"] == "categorical_dimension"
    assert role_dict["salary"] == "measure"
    assert role_dict["joining_date"] == "datetime_dimension"
    assert role_dict["performance_score"] == "measure"


def test_metric_discovery_marketing_domain():
    data = {
        "campaign": [f"Camp-{i}" for i in range(12)],
        "channel": ["Google", "Facebook", "LinkedIn", "Twitter"] * 3,
        "impressions": [1000, 5000, 2500, 8000] * 3,
        "clicks": [50, 200, 100, 400] * 3,
        "conversions": [5, 20, 10, 40] * 3,
        "spend": [150.0, 500.0, 300.0, 1000.0] * 3,
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)
    role_dict = {r.column: r.role for r in roles}

    assert role_dict["channel"] == "categorical_dimension"
    assert role_dict["impressions"] == "measure"
    assert role_dict["clicks"] == "measure"
    assert role_dict["conversions"] == "measure"
    assert role_dict["spend"] == "measure"
