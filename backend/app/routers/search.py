from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.retrieval import retrieve

router = APIRouter(prefix="/search", tags=["search"])

@router.get("")
def search(
    q: str = Query(..., min_length=1, description="Your question"),
    document_id: int | None = None,
    top_k: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return retrieve(db, q, document_id=document_id, top_k=top_k)