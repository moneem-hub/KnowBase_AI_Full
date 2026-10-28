from sqlalchemy import inspect, text
from app.database import Base, engine
from app import models  # noqa: F401  (importing registers the tables)

with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

Base.metadata.create_all(engine)

print("Tables:", sorted(inspect(engine).get_table_names()))