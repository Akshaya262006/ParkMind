
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from core.config import settings

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(password: str) -> str:
    """Hash a password before storing it in the database."""
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes.")

    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a submitted password against its stored hash."""
    try:
        password_bytes = password.encode("utf-8")

        if len(password_bytes) > 72:
            return False

        return bcrypt.checkpw(
            password_bytes,
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError, UnicodeError):
        return False


def create_access_token(user_id: int) -> str:
    """Create a signed JWT for an authenticated user."""
    if not settings.auth_secret_key:
        raise RuntimeError("AUTH_SECRET_KEY is not configured.")

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }

    return jwt.encode(
        payload,
        settings.auth_secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict | None:
    """Validate a JWT; return None if it is invalid or expired."""
    if not settings.auth_secret_key:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )

        if payload.get("type") != "access":
            return None

        if not str(payload.get("sub", "")).isdigit():
            return None

        return payload

    except jwt.InvalidTokenError:
        return None
