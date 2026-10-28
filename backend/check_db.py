from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    print("Server:", conn.execute(text("SELECT version()")).scalar())

    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

    ext = conn.execute(
        text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
    ).fetchone()
    print("pgvector:", ext)

    # cosine distance between two tiny vectors, to prove the vector operators work
    distance = conn.execute(text("SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector")).scalar()
    print("Test distance:", distance)