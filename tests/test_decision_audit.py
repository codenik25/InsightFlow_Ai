import pytest
from app.models.dataset import Dataset
from app.services.audit_service import DecisionAuditService
from app.schemas.audit import AuditEventCreate


def setup_audit_dataset(db_session):
    ds = Dataset(
        name="test_audit.csv",
        file_path="/tmp/test_audit.csv",
        file_size_bytes=100,
        row_count=10,
        column_count=2,
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)
    return ds


def test_audit_event_creation_and_ordering(db_session):
    ds = setup_audit_dataset(db_session)
    dec_id = "dec_123"

    # Emit event 1
    e1 = DecisionAuditService.record_event(
        db_session,
        ds.id,
        AuditEventCreate(
            decision_id=dec_id,
            recommendation_id="rec_1",
            event_type="RECOMMENDATION_CREATED",
            event_status="SUCCESS",
            source_service="recommendation_service",
            evidence_references={"metric": "conversion_rate"},
        ),
    )
    assert e1.id is not None
    assert e1.event_type == "RECOMMENDATION_CREATED"

    # Emit event 2
    e2 = DecisionAuditService.record_event(
        db_session,
        ds.id,
        AuditEventCreate(
            decision_id=dec_id,
            recommendation_id="rec_1",
            event_type="GUARDRAIL_EVALUATED",
            event_status="SUCCESS",
            source_service="guardrail_service",
            evidence_references={"feasibility_score": 95.0},
        ),
    )

    # Emit event 3
    e3 = DecisionAuditService.record_event(
        db_session,
        ds.id,
        AuditEventCreate(
            decision_id=dec_id,
            recommendation_id="rec_1",
            event_type="DECISION_APPROVED",
            event_status="SUCCESS",
            actor_type="USER",
            actor_id="user_admin",
            source_service="action_gate_service",
            evidence_references={"approval_id": "app_1"},
        ),
    )

    # Query audit trail
    trail = DecisionAuditService.get_audit_trail(db_session, ds.id, decision_id=dec_id)
    assert trail.total_events == 3
    events = trail.chronological_chain
    assert events[0].event_type == "RECOMMENDATION_CREATED"
    assert events[1].event_type == "GUARDRAIL_EVALUATED"
    assert events[2].event_type == "DECISION_APPROVED"
    assert events[2].actor_id == "user_admin"


def test_dataset_isolation(db_session):
    ds1 = setup_audit_dataset(db_session)
    ds2 = Dataset(
        name="test_audit_2.csv",
        file_path="/tmp/test_audit_2.csv",
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds2)
    db_session.commit()
    db_session.refresh(ds2)

    DecisionAuditService.record_event(
        db_session,
        ds1.id,
        AuditEventCreate(event_type="DECISION_CREATED", recommendation_id="rec_ds1"),
    )
    DecisionAuditService.record_event(
        db_session,
        ds2.id,
        AuditEventCreate(event_type="DECISION_CREATED", recommendation_id="rec_ds2"),
    )

    trail1 = DecisionAuditService.get_audit_trail(db_session, ds1.id)
    trail2 = DecisionAuditService.get_audit_trail(db_session, ds2.id)

    assert trail1.total_events == 1
    assert trail1.chronological_chain[0].recommendation_id == "rec_ds1"
    assert trail2.total_events == 1
    assert trail2.chronological_chain[0].recommendation_id == "rec_ds2"


def test_audit_api_endpoints(client, db_session):
    ds = setup_audit_dataset(db_session)
    dec_id = "dec_api_test"

    DecisionAuditService.record_event(
        db_session,
        ds.id,
        AuditEventCreate(
            decision_id=dec_id,
            recommendation_id=dec_id,
            event_type="ANALYSIS_COMPLETED",
        ),
    )

    # GET all dataset audit events
    res1 = client.get(f"/api/v1/datasets/{ds.id}/decision/audit")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["total_events"] == 1

    # GET decision-filtered audit events
    res2 = client.get(f"/api/v1/datasets/{ds.id}/decision/audit/{dec_id}")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total_events"] == 1
    assert data2["decision_id"] == dec_id
