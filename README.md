# 📚 KnowBase AI

A full-stack RAG chatbot. Upload PDFs, chat with them in a ChatGPT-style interface, and get streamed answers with page-level source references. If the document doesn't contain the answer, the bot says so instead of inventing one.

## Features

- **Chat with your PDFs:** upload a document and ask questions about it
- **General chat:** works as a normal AI assistant without a document
- **RAG pipeline:** relevant passages are retrieved with vector search before the answer is generated
- **Source references:** every answer shows the pages and passages it used
- **Streaming answers:** responses appear word by word via Server-Sent Events
- **Persistent chat history:** conversations and documents are stored in PostgreSQL
- **Unknown-answer handling:** if no passage is similar enough, the app answers "I couldn't find that in the uploaded document." without calling the LLM
- **Conversation memory:** the last 8 messages are sent with every question

## Architecture

```text
React (Vite + TypeScript)  <-- HTTP / SSE -->  FastAPI  <-- SQL -->  PostgreSQL + pgvector
                                                  |
                                                  +--> Groq API (LLM)
```

```text
Indexing:  PDF -> text per page -> sentence-aware chunks -> embeddings -> chunks table (pgvector)
Answering: question -> embedding -> cosine search (top 6, min similarity 0.25)
           -> prompt (instructions + chunks + history) -> Groq -> streamed answer + sources
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, react-markdown |
| Backend | FastAPI, SQLAlchemy, Uvicorn |
| Database | PostgreSQL with the pgvector extension (Neon) |
| Embeddings | Sentence Transformers (`all-MiniLM-L6-v2`, 384 dimensions) |
| LLM | Groq API (`openai/gpt-oss-120b` by default) |
| PDF parsing | PyMuPDF |

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/documents` | Upload and index a PDF |
| GET | `/documents` | List documents |
| DELETE | `/documents/{id}` | Delete a document and its chunks |
| GET | `/search?q=...` | Vector similarity search (debugging) |
| POST | `/conversations` | Create a conversation |
| GET | `/conversations` | List conversations |
| GET | `/conversations/{id}` | Conversation with messages and sources |
| DELETE | `/conversations/{id}` | Delete a conversation |
| POST | `/conversations/{id}/messages` | Ask a question (full answer) |
| POST | `/conversations/{id}/messages/stream` | Ask a question (streamed with SSE) |
| GET | `/health` | API and database health check |

Interactive docs are available at `http://127.0.0.1:8000/docs` when the backend is running.

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A PostgreSQL database with pgvector (a free [Neon](https://neon.com) project works)
- A [Groq API key](https://console.groq.com/keys)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in the values:

```text
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname?sslmode=require
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Create the tables and the vector index, then start the API:

```bash
python -m app.init_db
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. To point the UI at a different API, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

## Project structure

```text
KnowBase_AI_Full/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, routers
│   │   ├── database.py      # engine and session
│   │   ├── models.py        # documents, chunks, conversations, messages
│   │   ├── rag.py           # PDF extraction, chunking, embeddings
│   │   ├── retrieval.py     # pgvector similarity search
│   │   ├── llm.py           # prompts and Groq calls
│   │   └── routers/         # documents, search, chat endpoints
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.tsx
        ├── api.ts           # API client and SSE stream reader
        └── components/      # Sidebar, Composer, Message, ...
```

## Design decisions

- **pgvector instead of a separate vector store:** documents, chunks, embeddings and chat history live in one database that survives restarts.
- **Similarity threshold before the LLM:** if no chunk is relevant, the API returns a fixed "not found" message without a model call. This makes unknown-answer behavior reliable and saves tokens.
- **Sentence-aware chunking with overlap:** chunks end at sentence boundaries, and the last sentence is repeated in the next chunk so meaning isn't lost at the edges. Each chunk keeps its page number for citations.
- **Server-Sent Events for streaming:** simple, works over plain HTTP and is easy to consume from `fetch`.

## Limitations

- Scanned PDFs without a text layer are not supported (no OCR).
- Broad questions such as "summarize this document" retrieve poorly, because embedding search matches specific content.
- No authentication yet: all documents and chats are shared.
- One document per conversation.

## Possible improvements

- User accounts and per-user documents
- OCR for scanned PDFs
- Query rewriting and reranking to improve retrieval on follow-up and broad questions
- Multi-document chats
- Deployment (for example Render or Railway for the API and Vercel for the frontend)