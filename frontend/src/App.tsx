import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  createConversation,
  listDocuments,
  streamMessage,
  type ChatMessage,
  type DocumentInfo,
} from "./api";
import Message from "./components/Message";

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";

export default function App() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((e: unknown) => setError(messageOf(e)));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function changeDocument(value: string) {
    setDocumentId(value === "" ? null : Number(value));
    setConversationId(null); // a new chat starts with the next message
    setMessages([]);
    setError("");
  }

  function updateLast(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)));
  }

  function dropEmptyReply() {
    setMessages((ms) => {
      const last = ms[ms.length - 1];
      return last && last.role === "assistant" && !last.content
        ? ms.slice(0, -1)
        : ms;
    });
  }

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    setError("");
    setMessages((ms) => [
      ...ms,
      { role: "user", content: text },
      { role: "assistant", content: "", sources: [], streaming: true },
    ]);

    try {
      let id = conversationId;
      if (id === null) {
        const conversation = await createConversation(documentId);
        id = conversation.id;
        setConversationId(id);
      }
      await streamMessage(id, text, {
        onSources: (sources) => updateLast((m) => ({ ...m, sources })),
        onToken: (token) =>
          updateLast((m) => ({ ...m, content: m.content + token })),
        onError: (detail) => setError(detail),
      });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      updateLast((m) => ({ ...m, streaming: false }));
      dropEmptyReply();
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📚 KnowBase AI</h1>
        <select
          value={documentId ?? ""}
          onChange={(e) => changeDocument(e.target.value)}
          disabled={busy}
        >
          <option value="">No document (general chat)</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </select>
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty">
            {documentId
              ? "Ask anything about the selected document."
              : "Ask me anything, or pick a document above to chat with it."}
          </div>
        )}
        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}
        <div ref={bottomRef} />
      </main>

      {error && <div className="error">{error}</div>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}