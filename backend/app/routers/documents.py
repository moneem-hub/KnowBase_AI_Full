from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import rag
from app.database import get_db
from app.models import Chunk, Document

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_BYTES = 20 * 1024 * 1024  # 20 MB


def to_dict(doc, chunk_count):
    return {
        "id": doc.id,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "chunk_count": chunk_count,
        "created_at": doc.created_at,
    }


# Plain "def" (not "async def"): FastAPI runs it in a worker thread, so the
# slow embedding work doesn't block other requests.
@router.post("", status_code=201)
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    data = file.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 20 MB.")

    try:
        pages = rag.extract_pages(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF.")

    pieces = [(page_no, c) for page_no, text in pages for c in rag.split_page(text)]
    if not pieces:
        raise HTTPException(
            status_code=422, detail="No extractable text found. Is this a scanned PDF?"
        )

    embeddings = rag.embed_texts([text for _, text in pieces])

    doc = Document(filename=file.filename, page_count=len(pages))
    db.add(doc)
    db.flush()  # gives doc an id
    db.add_all(
        [
            Chunk(document_id=doc.id, page=page_no, chunk_index=i, text=text, embedding=emb)
            for i, ((page_no, text), emb) in enumerate(zip(pieces, embeddings))
        ]
    )
    db.commit()
    db.refresh(doc)
    return to_dict(doc, len(pieces))


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Document, func.count(Chunk.id))
        .outerjoin(Chunk)
        .group_by(Document.id)
        .order_by(Document.id.desc())
    ).all()
    return [to_dict(doc, n) for doc, n in rows]


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    db.delete(doc)  # its chunks are deleted too
    db.commit()