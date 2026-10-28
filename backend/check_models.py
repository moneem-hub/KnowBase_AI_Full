import random
from sqlalchemy import select
from app.database import SessionLocal
from app.models import EMBEDDING_DIM, Chunk, Document

db = SessionLocal()

doc = Document(filename="test.pdf", page_count=1)
db.add(doc)
db.flush()

for i in range(3):
    db.add(
        Chunk(
            document_id=doc.id,
            page=1,
            chunk_index=i,
            text=f"test chunk {i}",
            embedding=[random.random() for _ in range(EMBEDDING_DIM)],
        )
    )
db.flush()

query = [random.random() for _ in range(EMBEDDING_DIM)]
rows = db.execute(
    select(Chunk.text, Chunk.embedding.cosine_distance(query).label("dist"))
    .order_by("dist")
    .limit(2)
).all()

for r in rows:
    print(r.text, "| distance", round(r.dist, 3))

db.rollback()  # nothing is saved: this was only a test
db.close()
print("Models OK")