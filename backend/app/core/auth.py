from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extract bearer token from Authorization header or HTTP-only cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    
    # Fallback to session cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        if cookie_token.startswith("Bearer "):
            return cookie_token[7:]
        return cookie_token
        
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """Dependency that enforces real authentication; raises 401 if unauthenticated."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access your datasets.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with session not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency returning User if valid authentication token is provided, or None."""
    token = extract_token_from_request(request)
    if not token:
        return None
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    
    user_id = payload["sub"]
    return db.query(User).filter(User.id == user_id).first()


def verify_user_workspace_access(user: User, workspace_id: str, db: Session) -> Workspace:
    """Enforce workspace ownership; raises 404 if not found, 403 if unauthorized."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found.",
        )
    
    # If workspace has an explicit owner and it is not this user -> 403 Forbidden
    if workspace.owner_id is not None and workspace.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access this workspace.",
        )
    
    return workspace


def verify_user_project_access(user: User, project_id: str, db: Session) -> Project:
    """Enforce project boundary and workspace ownership; raises 404 if not found, 403 if unauthorized."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    
    verify_user_workspace_access(user, project.workspace_id, db)
    return project


def verify_user_dataset_access(user: User, dataset_id: str, db: Session) -> Dataset:
    """Enforce IDOR protection: user can only access datasets belonging to their project/workspace."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )
    
    if dataset.project_id:
        verify_user_project_access(user, dataset.project_id, db)
        
    return dataset
