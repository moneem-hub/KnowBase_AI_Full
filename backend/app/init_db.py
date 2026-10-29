from sqlalchemy import inspect, text

from app import models  # noqa: F401  (importing registers the tables)
from app.database import Base, engine

with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

Base.metadata.create_all(engine)

with engine.begin() as conn:
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS chunks_embedding_idx "
            "ON chunks USING hnsw (embedding vector_cosine_ops)"
        )
    )

print("Tables:", sorted(inspect(engine).get_table_names()))
print("Vector index ready.")