from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app import llm
from app.database import get_db
from app.models import Conversation, Document, Message
from app.retrieval import retrieve

router = APIRouter(prefix="/conversations", tags=["chat"])


class ConversationCreate(BaseModel):
    document_id: int | None = None
    title: str = "New chat"


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


def conv_dict(c):
    return {
        "id": c.id,
        "title": c.title,
        "document_id": c.document_id,
        "created_at": c.created_at,
    }

def msg_dict(m):
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "sources": m.sources or [],
        "created_at": m.created_at,
    }

def get_conversation(db: Session, conversation_id: int) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv

@router.post("", status_code=201)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    if body.document_id is not None and db.get(Document, body.document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    conv = Conversation(title=body.title, document_id=body.document_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv_dict(conv)

@router.get("")
def list_conversations(db: Session = Depends(get_db)):
    rows = db.scalars(select(Conversation).order_by(Conversation.id.desc())).all()
    return [conv_dict(c) for c in rows]

@router.get("/{conversation_id}")
def read_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = get_conversation(db, conversation_id)
    return {**conv_dict(conv), "messages": [msg_dict(m) for m in conv.messages]}

@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    db.delete(get_conversation(db, conversation_id))
    db.commit()

# Plain "def": FastAPI runs it in a worker thread, so slow model calls
# don't block other requests.
@router.post("/{conversation_id}/messages")
def send_message(
    conversation_id: int, body: MessageCreate, db: Session = Depends(get_db)
):
    conv = get_conversation(db, conversation_id)
    question = body.content.strip()

    history = [
        {"role": m.role, "content": m.content}
        for m in conv.messages[-llm.HISTORY_LIMIT:]
    ]
    has_doc = conv.document_id is not None
    hits = retrieve(db, question, document_id=conv.document_id) if has_doc else []

    if has_doc and not hits:
        answer = llm.NOT_FOUND  # nothing relevant found: skip the model call
    else:
        try:
            answer = llm.generate_answer(
                llm.build_messages(question, history, hits, has_doc)
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Language model error: {e}")

    if conv.title == "New chat":
        conv.title = question[:60]

    db.add(Message(conversation_id=conv.id, role="user", content=question))
    reply = Message(
        conversation_id=conv.id, role="assistant", content=answer, sources=hits or None
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return msg_dict(reply)