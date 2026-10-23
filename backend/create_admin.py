
import re
from getpass import getpass

from sqlalchemy.orm import Session

from core.security import hash_password
from database.connection import SessionLocal
from models.user import User


def main() -> None:
    full_name = input("Admin full name: ").strip()
    email = input("Admin email: ").strip().lower()

    if len(full_name) < 2 or len(full_name) > 100:
        print("Full name must contain 2-100 characters.")
        return

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        print("Enter a valid email address.")
        return

    password = getpass("Admin password (at least 12 characters): ")
    confirmation = getpass("Confirm admin password: ")

    if password != confirmation:
        print("Passwords do not match.")
        return

    if len(password) < 12:
        print("Use at least 12 characters for an admin password.")
        return

    if len(password.encode("utf-8")) > 72:
        print("Password exceeds the supported 72-byte limit.")
        return

    db: Session = SessionLocal()

    try:
        existing = db.query(User).filter(User.email == email).first()

        if existing:
            print("That email already exists. No account was changed.")
            return

        admin = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role="ADMIN",
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("Administrator created successfully.")
        print(f"Admin ID: {admin.id}")
        print(f"Admin email: {admin.email}")
        print(f"Role: {admin.role}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
