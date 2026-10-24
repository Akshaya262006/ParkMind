from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings

database_url = settings.database_url

# Use the PostgreSQL driver already installed in requirements.txt
if database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://", "postgresql+psycopg2://", 1
    )
elif database_url.startswith("postgresql+psycopg://"):
    database_url = database_url.replace(
        "postgresql+psycopg://", "postgresql+psycopg2://", 1
    )

engine = create_engine(database_url, echo=False)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
