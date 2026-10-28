from sqlalchemy import select
from sqlalchemy.orm import Session
from app import rag
from app.models import Chunk, Document

TOP_K = 6          # chunks returned per question
MIN_SCORE = 0.25   # below this similarity = "not in the document"


def retrieve(
    db: Session,
    question: str,
    document_id: int | None = None,
    top_k: int = TOP_K,
    min_score: float = MIN_SCORE,
):
    """Return the chunks most similar to the question, best first."""
    query_vec = rag.embed_texts([question])[0]
    distance = Chunk.embedding.cosine_distance(query_vec)

    stmt = (
        select(Chunk, Document.filename, distance.label("distance"))
        .join(Document, Chunk.document_id == Document.id)
        .order_by(distance)
        .limit(top_k)
    )
    if document_id is not None:
        stmt = stmt.where(Chunk.document_id == document_id)

    hits = []
    for chunk, filename, dist in db.execute(stmt).all():
        score = 1 - float(dist)
        if score >= min_score:
            hits.append(
                {
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "source": filename,
                    "page": chunk.page,
                    "text": chunk.text,
                    "score": round(score, 3),
                }
            )
    return hits