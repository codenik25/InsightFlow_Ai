from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.auth import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.project import Project
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    AuthResponse,
)

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Register a new user, hash password with bcrypt, and associate a default workspace."""
    normalized_email = payload.email.lower().strip()
    
    # 1. Duplicate email check
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )
    
    # 2. Securely hash password
    hashed_pw = hash_password(payload.password)
    
    # 3. Create user record
    new_user = User(
        email=normalized_email,
        hashed_password=hashed_pw,
        full_name=payload.full_name.strip(),
        role=payload.role or "Admin",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 4. Provision or assign initial user workspace
    # Check if an unowned workspace exists (e.g. initial demo workspace) or create a fresh one
    unowned_ws = db.query(Workspace).filter(Workspace.owner_id == None).first()  # noqa: E711
    if unowned_ws:
        unowned_ws.owner_id = new_user.id
        db.commit()
    else:
        # Create dedicated workspace
        user_ws = Workspace(
            owner_id=new_user.id,
            name=f"{new_user.full_name.split()[0]}'s Workspace",
            description=f"Primary analytics workspace for {new_user.full_name}",
        )
        db.add(user_ws)
        db.commit()
        db.refresh(user_ws)
        
        # Create initial project
        initial_proj = Project(
            workspace_id=user_ws.id,
            name="Hospital Operations",
            description="Operational analytics and decision intelligence pipeline",
        )
        db.add(initial_proj)
        db.commit()
    
    # 5. Issue JWT token
    token = create_access_token({"sub": new_user.id, "email": new_user.email, "role": new_user.role})
    
    # 6. Set HTTP-only session cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS production environments
        max_age=60 * 60 * 24 * 7,
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(new_user),
        access_token=token,
        token_type="bearer",
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate user with real email and password verification."""
    normalized_email = payload.email.lower().strip()
    
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Ensure user has a workspace assigned
    user_ws = db.query(Workspace).filter(Workspace.owner_id == user.id).first()
    if not user_ws:
        unowned_ws = db.query(Workspace).filter(Workspace.owner_id == None).first()  # noqa: E711
        if unowned_ws:
            unowned_ws.owner_id = user.id
            db.commit()
    
    # Issue JWT token
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    
    # Set HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 24 * 7,
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve profile and identity of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
def logout(response: Response) -> dict:
    """Log out authenticated user by clearing session cookie."""
    response.delete_cookie(key="access_token")
    return {"message": "Successfully logged out of InsightFlow AI session."}
