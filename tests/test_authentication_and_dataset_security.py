import io
import uuid
import pytest
from app.models.user import User
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset
from app.core.security import verify_password


def test_1_register_valid_user(client, db_session):
    """Test 1: Register valid user with email and secure password."""
    email = f"user_{uuid.uuid4().hex[:8]}@insightflow.ai"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Nikunj Rathi",
            "role": "Admin",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["full_name"] == "Nikunj Rathi"
    assert data["user"]["role"] == "Admin"
    assert "access_token" in res.cookies


def test_2_duplicate_registration(client, db_session):
    """Test 2: Reject duplicate registration with HTTP 400."""
    email = f"dup_{uuid.uuid4().hex[:8]}@insightflow.ai"
    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "Duplicate Tester",
    }
    first_res = client.post("/api/v1/auth/register", json=payload)
    assert first_res.status_code == 201

    dup_res = client.post("/api/v1/auth/register", json=payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]


def test_3_login_valid_credentials(client, db_session):
    """Test 3: Authenticate with valid registered credentials."""
    email = f"login_{uuid.uuid4().hex[:8]}@insightflow.ai"
    password = "CorrectPassword123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Login User"},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == email


def test_4_login_invalid_password(client, db_session):
    """Test 4: Reject invalid password with HTTP 401."""
    email = f"bad_pw_{uuid.uuid4().hex[:8]}@insightflow.ai"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "OriginalPassword123!", "full_name": "Test User"},
    )

    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
    assert "Invalid email or password" in bad_login.json()["detail"]


def test_5_unauthenticated_existing_dataset_request(client, db_session):
    """Test 5: Unauthenticated access to existing datasets is rejected with HTTP 401."""
    # Ensure no cookies or headers
    client.cookies.clear()
    res = client.get("/api/v1/datasets/existing")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]


def test_6_authenticated_authorized_dataset_request(client, db_session):
    """Test 6: Authenticated user can access their authorized project datasets."""
    email = f"auth_user_{uuid.uuid4().hex[:8]}@insightflow.ai"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Authorized User"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user"]["id"]

    # Provision workspace and project owned by this user
    ws = Workspace(name="Owner WS", owner_id=user_id)
    db_session.add(ws)
    db_session.commit()

    proj = Project(name="Owner Proj", workspace_id=ws.id)
    db_session.add(proj)
    db_session.commit()

    ds = Dataset(name="patient_records_2024.csv", project_id=proj.id, row_count=181, column_count=23, status="READY")
    db_session.add(ds)
    db_session.commit()

    # Query with Bearer token
    res = client.get(
        f"/api/v1/datasets/existing?project_id={proj.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(item["name"] == "patient_records_2024.csv" for item in data["items"])


def test_7_authenticated_unauthorized_dataset_request(client, db_session):
    """Test 7: Authenticated user accessing another user's project datasets receives HTTP 403."""
    # User 1 (Victim)
    u1_res = client.post(
        "/api/v1/auth/register",
        json={"email": f"u1_{uuid.uuid4().hex[:6]}@if.ai", "password": "Pass1!", "full_name": "User One"},
    ).json()
    u1_id = u1_res["user"]["id"]

    ws1 = Workspace(name="WS1", owner_id=u1_id)
    db_session.add(ws1)
    db_session.commit()

    proj1 = Project(name="Secret Proj", workspace_id=ws1.id)
    db_session.add(proj1)
    db_session.commit()

    # User 2 (Attacker)
    u2_res = client.post(
        "/api/v1/auth/register",
        json={"email": f"u2_{uuid.uuid4().hex[:6]}@if.ai", "password": "Pass2!", "full_name": "User Two"},
    ).json()
    u2_token = u2_res["access_token"]

    # User 2 attempts to fetch User 1's project datasets
    res = client.get(
        f"/api/v1/datasets/existing?project_id={proj1.id}",
        headers={"Authorization": f"Bearer {u2_token}"},
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_8_session_persistence(client, db_session):
    """Test 8: Session token persists user identity via /api/v1/auth/me."""
    email = f"session_{uuid.uuid4().hex[:8]}@insightflow.ai"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SessionPassword123!", "full_name": "Session Tester"},
    ).json()
    token = reg_res["access_token"]

    # Verify /me endpoint with token
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email
    assert me_res.json()["full_name"] == "Session Tester"


def test_9_logout(client, db_session):
    """Test 9: Logout clears session cookie."""
    email = f"logout_{uuid.uuid4().hex[:8]}@insightflow.ai"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "LogoutPassword123!", "full_name": "Logout Tester"},
    )
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    assert "Successfully logged out" in logout_res.json()["message"]


def test_10_password_is_never_stored_plaintext(client, db_session):
    """Test 10: Passwords are encrypted with bcrypt salt and never stored in plaintext."""
    raw_password = "SuperSecretPassword123!"
    email = f"sec_{uuid.uuid4().hex[:8]}@insightflow.ai"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": raw_password, "full_name": "Crypto Check"},
    )

    user_record = db_session.query(User).filter(User.email == email).first()
    assert user_record is not None
    # Password must not equal plain password
    assert user_record.hashed_password != raw_password
    # Must have bcrypt signature ($2b$ or $2a$)
    assert user_record.hashed_password.startswith("$2")
    # Must be verifiable by bcrypt
    assert verify_password(raw_password, user_record.hashed_password) is True


def test_11_idor_project_isolation(client, db_session):
    """Test 11: IDOR protection: User A cannot retrieve Dataset B owned by User B."""
    # User A (Owner of ds_a)
    u_a = client.post(
        "/api/v1/auth/register",
        json={"email": f"a_{uuid.uuid4().hex[:6]}@if.ai", "password": "PasswordA!", "full_name": "User A"},
    ).json()

    ws_a = Workspace(name="WS A", owner_id=u_a["user"]["id"])
    db_session.add(ws_a)
    db_session.commit()

    proj_a = Project(name="Proj A", workspace_id=ws_a.id)
    db_session.add(proj_a)
    db_session.commit()

    ds_a = Dataset(name="sensitive_financials.csv", project_id=proj_a.id, row_count=50, column_count=10)
    db_session.add(ds_a)
    db_session.commit()

    # User B (Attacker)
    u_b = client.post(
        "/api/v1/auth/register",
        json={"email": f"b_{uuid.uuid4().hex[:6]}@if.ai", "password": "PasswordB!", "full_name": "User B"},
    ).json()
    token_b = u_b["access_token"]

    # User B attempts to access Dataset A directly by ID
    idor_res = client.get(
        f"/api/v1/datasets/existing/{ds_a.id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert idor_res.status_code == 403
    assert "Forbidden" in idor_res.json()["detail"]

    # User A accesses Dataset A -> 200 OK
    authorized_res = client.get(
        f"/api/v1/datasets/existing/{ds_a.id}",
        headers={"Authorization": f"Bearer {u_a['access_token']}"},
    )
    assert authorized_res.status_code == 200
    assert authorized_res.json()["name"] == "sensitive_financials.csv"
