from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app


@pytest.fixture
async def client(db_session: AsyncSession) -> Any:
    async def override_get_db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "new_athlete@example.com", "password": "StrongPassword123!"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new_athlete@example.com"
    assert data["is_active"] is True
    assert data["is_verified"] is False
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "StrongPassword123!"},
    )
    res2 = await client.post(
        "/api/v1/auth/register",
        json={"email": "DUP@example.com", "password": "OtherPassword456!"},
    )
    assert res2.status_code == 409
    assert res2.json()["detail"] == "Email already registered"


@pytest.mark.asyncio
async def test_register_password_strength_validation(client: AsyncClient) -> None:
    # Too short (< 8 chars)
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "Sh1!"},
    )
    assert res.status_code == 422

    # Missing uppercase
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "no_upper@example.com", "password": "password123!"},
    )
    assert res.status_code == 422

    # Missing digit
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "no_digit@example.com", "password": "Password!"},
    )
    assert res.status_code == 422

    # Missing special character
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "no_spec@example.com", "password": "Password123"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "login_user@example.com", "password": "ValidPassword123!"},
    )

    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "login_user@example.com", "password": "ValidPassword123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 1800


@pytest.mark.asyncio
async def test_login_invalid_credentials_prevent_enumeration(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "real_user@example.com", "password": "ValidPassword123!"},
    )

    # Wrong password for existing email
    res1 = await client.post(
        "/api/v1/auth/login",
        json={"email": "real_user@example.com", "password": "WrongPassword999!"},
    )
    assert res1.status_code == 401
    assert res1.json()["detail"] == "Invalid credentials"

    # Non-existent email
    res2 = await client.post(
        "/api/v1/auth/login",
        json={"email": "fake_user@example.com", "password": "WrongPassword999!"},
    )
    assert res2.status_code == 401
    assert res2.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_refresh_token_lifecycle(client: AsyncClient) -> None:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "refresh_user@example.com", "password": "ValidPassword123!"},
    )
    assert reg.status_code == 201

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "refresh_user@example.com", "password": "ValidPassword123!"},
    )
    tokens = login_res.json()
    refresh_token = tokens["refresh_token"]
    access_token = tokens["access_token"]

    # Refresh with valid refresh token succeeds
    ref_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_res.status_code == 200
    new_tokens = ref_res.json()
    assert "access_token" in new_tokens
    assert new_tokens["access_token"] != access_token

    # Refresh with access token fails with 401 (explicit token type verification)
    bad_type_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert bad_type_res.status_code == 401
    assert "refresh token required" in bad_type_res.json()["detail"]


@pytest.mark.asyncio
async def test_logout_endpoint(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "logout_user@example.com", "password": "ValidPassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "logout_user@example.com", "password": "ValidPassword123!"},
    )
    access_token = login_res.json()["access_token"]

    # Logout is client-side disposal returning 204
    res = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_change_password_lifecycle(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "pw_change@example.com", "password": "OldPassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "pw_change@example.com", "password": "OldPassword123!"},
    )
    access_token = login_res.json()["access_token"]

    # Incorrect current password fails
    fail_res = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"current_password": "WrongOldPassword!", "new_password": "NewPassword456!"},
    )
    assert fail_res.status_code == 400

    # Correct current password succeeds
    ok_res = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"current_password": "OldPassword123!", "new_password": "NewPassword456!"},
    )
    assert ok_res.status_code == 200
    assert ok_res.json()["message"] == "Password updated successfully"

    # Old password no longer works
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "pw_change@example.com", "password": "OldPassword123!"},
    )
    assert old_login.status_code == 401

    # New password works
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "pw_change@example.com", "password": "NewPassword456!"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_deactivate_account(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "deactivate_user@example.com", "password": "DeletePassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "deactivate_user@example.com", "password": "DeletePassword123!"},
    )
    access_token = login_res.json()["access_token"]

    # Wrong password fails
    del_fail = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"password": "WrongPassword!"},
    )
    assert del_fail.status_code == 400

    # Correct password succeeds (soft delete)
    del_ok = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"password": "DeletePassword123!"},
    )
    assert del_ok.status_code == 204

    # Deactivated user cannot log in
    post_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "deactivate_user@example.com", "password": "DeletePassword123!"},
    )
    assert post_login.status_code == 401

    # Deactivated user's token is rejected on protected routes
    get_me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert get_me.status_code == 401
