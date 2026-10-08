from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.evidence import EvidenceGraphResponse, EvidenceChainResponse
from app.services.evidence_service import EvidenceService

router = APIRouter()


@router.get(
    "/projects/{project_id}/evidence",
    response_model=EvidenceGraphResponse,
    status_code=status.HTTP_200_OK,
    summary="Get project-level decision evidence graph",
)
def get_project_evidence(
    project_id: str,
    node_type: Optional[str] = Query(None, description="Filter by node type"),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
) -> EvidenceGraphResponse:
    """Retrieve full decision evidence graph scoped to a project boundary."""
    return EvidenceService.get_project_evidence_graph(
        db=db,
        project_id=project_id,
        node_type=node_type,
        limit=limit,
    )


@router.get(
    "/datasets/{dataset_id}/evidence",
    response_model=EvidenceGraphResponse,
    status_code=status.HTTP_200_OK,
    summary="Get dataset-lineage-scoped decision evidence graph",
)
def get_dataset_evidence(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> EvidenceGraphResponse:
    """Retrieve evidence graph rooted at a specific dataset version and its lineage."""
    return EvidenceService.get_dataset_evidence_graph(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/runs/{run_id}/evidence",
    response_model=EvidenceGraphResponse,
    status_code=status.HTTP_200_OK,
    summary="Get analysis-run-centered evidence graph",
)
def get_run_evidence(
    run_id: str,
    db: Session = Depends(get_db),
) -> EvidenceGraphResponse:
    """Retrieve immediate upstream and downstream evidence graph for an analysis run."""
    return EvidenceService.get_run_evidence_graph(
        db=db,
        run_id=run_id,
    )


@router.get(
    "/evidence/{node_type}/{node_id}",
    response_model=EvidenceGraphResponse,
    status_code=status.HTTP_200_OK,
    summary="Get 1-hop evidence neighbors for any node",
)
def get_node_evidence(
    node_type: str,
    node_id: str,
    db: Session = Depends(get_db),
) -> EvidenceGraphResponse:
    """Retrieve immediate upstream and downstream evidence connections for a node."""
    return EvidenceService.get_node_evidence(
        db=db,
        node_type=node_type,
        node_id=node_id,
    )


@router.get(
    "/decisions/{decision_id}/evidence",
    response_model=EvidenceChainResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete backward evidence provenance chain for a decision",
)
def get_decision_evidence_chain(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> EvidenceChainResponse:
    """Retrieve complete multi-hop provenance chain answering WHY a decision/recommendation exists."""
    chain = EvidenceService.get_decision_evidence_chain(
        db=db,
        decision_id=decision_id,
    )
    if project_id and chain and getattr(chain, "project_id", None) and chain.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision '{decision_id}' not found in project '{project_id}'.",
        )
    return chain

