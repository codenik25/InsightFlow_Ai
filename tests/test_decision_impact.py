import pytest
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_outcome import DecisionOutcome
from app.services.impact_service import DecisionImpactService
from app.schemas.impact import ImpactMeasurementCreate


def setup_test_dataset(db_session):
    ds = Dataset(
        name="test_impact.csv",
        file_path="/tmp/test_impact.csv",
        file_size_bytes=100,
        row_count=10,
        column_count=2,
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)


    rec = DecisionRecommendation(
        dataset_id=ds.id,
        title="Increase Efficiency",
        recommendation_type="optimization",
        impact_level="high",
        expected_impact="Boost output",
        action_items=[],
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)
    return ds, rec


def test_maximize_objective_impact(db_session):
    ds, rec = setup_test_dataset(db_session)
    payload = ImpactMeasurementCreate(
        recommendation_id=rec.id,
        metric_name="revenue",
        objective="maximize",
        baseline_value=100.0,
        expected_value=120.0,
        actual_value=115.0,
        monetary_conversion_rate=2.0,
    )
    res = DecisionImpactService.create_impact_measurement(db_session, ds.id, payload)
    assert res.expected_change == 20.0
    assert res.actual_change == 15.0
    assert res.variance == -5.0
    assert res.achievement_percentage == 75.0
    assert res.status == "PARTIALLY_ACHIEVED"
    assert res.value_created == 30.0  # 15.0 * 2.0


def test_minimize_objective_impact(db_session):
    ds, rec = setup_test_dataset(db_session)
    payload = ImpactMeasurementCreate(
        recommendation_id=rec.id,
        metric_name="costs",
        objective="minimize",
        baseline_value=100.0,
        expected_value=80.0,
        actual_value=85.0,
    )
    res = DecisionImpactService.create_impact_measurement(db_session, ds.id, payload)
    assert res.expected_change == 20.0  # baseline - expected = 100 - 80
    assert res.actual_change == 15.0    # baseline - actual = 100 - 85
    assert res.variance == -5.0
    assert res.achievement_percentage == 75.0
    assert res.status == "PARTIALLY_ACHIEVED"
    assert res.value_created is None


def test_achieved_status(db_session):
    ds, rec = setup_test_dataset(db_session)
    payload = ImpactMeasurementCreate(
        recommendation_id=rec.id,
        metric_name="throughput",
        objective="maximize",
        baseline_value=10.0,
        expected_value=20.0,
        actual_value=20.0,
    )
    res = DecisionImpactService.create_impact_measurement(db_session, ds.id, payload)
    assert res.achievement_percentage == 100.0
    assert res.status == "ACHIEVED"


def test_not_achieved_status(db_session):
    ds, rec = setup_test_dataset(db_session)
    payload = ImpactMeasurementCreate(
        recommendation_id=rec.id,
        metric_name="yield",
        objective="maximize",
        baseline_value=50.0,
        expected_value=100.0,
        actual_value=60.0,
    )
    res = DecisionImpactService.create_impact_measurement(db_session, ds.id, payload)
    assert res.achievement_percentage == 20.0
    assert res.status == "NOT_ACHIEVED"


def test_zero_baseline_and_zero_expected_change(db_session):
    ds, rec = setup_test_dataset(db_session)
    # Zero baseline maximize
    res1 = DecisionImpactService.create_impact_measurement(
        db_session,
        ds.id,
        ImpactMeasurementCreate(
            recommendation_id=rec.id,
            metric_name="new_leads",
            objective="maximize",
            baseline_value=0.0,
            expected_value=50.0,
            actual_value=50.0,
        ),
    )
    assert res1.achievement_percentage == 100.0

    # Zero expected change
    res2 = DecisionImpactService.create_impact_measurement(
        db_session,
        ds.id,
        ImpactMeasurementCreate(
            recommendation_id=rec.id,
            metric_name="steady_metric",
            objective="maximize",
            baseline_value=100.0,
            expected_value=100.0,
            actual_value=100.0,
        ),
    )
    assert res2.achievement_percentage == 100.0


def test_unmeasurable_missing_actual(db_session):
    ds, rec = setup_test_dataset(db_session)
    payload = ImpactMeasurementCreate(
        recommendation_id=rec.id,
        metric_name="unknown",
        objective="maximize",
        baseline_value=100.0,
        expected_value=120.0,
        actual_value=None,
    )
    res = DecisionImpactService.create_impact_measurement(db_session, ds.id, payload)
    assert res.status == "UNMEASURABLE"


def test_impact_api_endpoints(client, db_session):
    ds, rec = setup_test_dataset(db_session)

    # POST impact endpoint
    post_res = client.post(
        f"/api/v1/datasets/{ds.id}/decision/impact",
        json={
            "recommendation_id": rec.id,
            "metric_name": "API_Metric",
            "objective": "maximize",
            "baseline_value": 50.0,
            "expected_value": 100.0,
            "actual_value": 98.0,
            "monetary_conversion_rate": 10.0,
        },
    )
    assert post_res.status_code == 201
    data = post_res.json()
    impact_id = data["id"]
    assert data["status"] == "ACHIEVED"
    assert data["value_created"] == 480.0  # (98-50)*10

    # GET single impact
    get_res = client.get(f"/api/v1/datasets/{ds.id}/decision/impact/{impact_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == impact_id

    # GET summary
    summary_res = client.get(f"/api/v1/datasets/{ds.id}/decision/impact")
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert summary_data["total_measurements"] == 1
    assert summary_data["achieved_count"] == 1
    assert summary_data["total_value_created"] == 480.0
