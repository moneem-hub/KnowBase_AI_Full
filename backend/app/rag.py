import re
from functools import lru_cache
import pymupdf
from sentence_transformers import SentenceTransformer

EMBED_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 900  # max characters per chunk


@lru_cache(maxsize=1)
def get_embedder():
    """Load the embedding model once, on first use, and reuse it."""
    return SentenceTransformer(EMBED_MODEL)


def embed_texts(texts):
    vectors = get_embedder().encode(texts, normalize_embeddings=True, batch_size=32)
    return vectors.tolist()


def extract_pages(pdf_bytes):
    """Return [(page_number, text)] for pages that contain text."""
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        pages = [(i + 1, page.get_text().strip()) for i, page in enumerate(doc)]
    return [(num, text) for num, text in pages if text]


def split_page(text):
    """Split one page into chunks of up to CHUNK_SIZE characters, at sentence
    boundaries, repeating the last sentence of a chunk at the start of the next."""
    text = re.sub(r"\s+", " ", text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [
        s[i:i + CHUNK_SIZE] for s in sentences for i in range(0, len(s), CHUNK_SIZE)
    ]
    chunks, current, length = [], [], 0
    for s in sentences:
        if current and length + len(s) > CHUNK_SIZE:
            chunks.append(" ".join(current))
            current = current[-1:]
            length = sum(len(x) + 1 for x in current)
        current.append(s)
        length += len(s) + 1
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if len(c) > 50]