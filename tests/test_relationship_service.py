import pandas as pd
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.relationship_service import RelationshipService


def test_relationship_service_positive_correlation():
    data = {
        "units_sold": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "total_revenue": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    }
    df = pd.DataFrame(data)
    roles = MetricDiscoveryService.discover_column_roles(df)

    rel = RelationshipService.evaluate_relationships(df, roles)
    assert len(rel) == 1
    assert rel[0].correlation == 1.0
    assert rel[0].strength == "strong_positive"

    dist = RelationshipService.evaluate_distributions(df, roles)
    assert len(dist) == 2
    cols = [d.column for d in dist]
    assert "units_sold" in cols
    assert "total_revenue" in cols
