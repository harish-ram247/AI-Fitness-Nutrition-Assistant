from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def require_admin_key(
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
) -> None:
    """Validate administrative secret key for privileged operations.

    Used for knowledge base management and administrative tasks.
    """
    settings = get_settings()
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
