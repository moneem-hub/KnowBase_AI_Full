import os
import re
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
HISTORY_LIMIT = 8  # past messages sent to the model

NOT_FOUND = "I couldn't find that in the uploaded document."
GENERAL_PROMPT = "You are KnowBase AI, a helpful and concise assistant."
RAG_PROMPT = (
    "You are KnowBase AI, a precise assistant that answers questions about a document. "
    "Use ONLY the document excerpts below. Each excerpt is labelled with its page. "
    "Answer directly, without phrases like 'the excerpts say' or 'according to the text'. "
    "For questions about reasons, causes or impacts, give a short bulleted list. "
    "Otherwise answer in 2-4 clear sentences. "
    "Cite pages in brackets like (p. 3). "
    "Ignore quiz questions or answer options unless the user asks about them. "
    "If the excerpts do not contain enough information, reply exactly: "
    f"\"{NOT_FOUND}\" Never invent facts."
)

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is missing. Add it to backend/.env")
        _client = Groq(api_key=api_key)
    return _client

def clean(text):
    # remove <think>...</think> reasoning blocks some models print
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL).strip()

def build_messages(question, history, hits, has_doc):
    if has_doc:
        context = "\n\n".join(
            f"[Source: {h['source']}, page {h['page']}]\n{h['text']}" for h in hits
        )
        system = f"{RAG_PROMPT}\n\nDOCUMENT EXCERPTS:\n{context}"
    else:
        system = GENERAL_PROMPT
    return (
        [{"role": "system", "content": system}]
        + history[-HISTORY_LIMIT:]
        + [{"role": "user", "content": question}]
    )

def generate_answer(messages):
    response = get_client().chat.completions.create(
        model=MODEL, messages=messages, temperature=0.2, max_tokens=1000
    )
    return clean(response.choices[0].message.content)