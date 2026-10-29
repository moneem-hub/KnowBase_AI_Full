import { useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation,
  deleteDocument,
  getConversation,
  listConversations,
  listDocuments,
  streamMessage,
  uploadDocument,
  type ChatMessage,
  type Conversation,
  type DocumentInfo,
} from "./api";
import Composer from "./components/Composer";
import { FileIcon, MenuIcon } from "./components/Icons";
import Message from "./components/Message";
import Sidebar from "./components/Sidebar";

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";
const isMobile = () => window.innerWidth <= 768;

export default function App() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeDocument = documents.find((d) => d.id === documentId) ?? null;
  const title =
    conversations.find((c) => c.id === conversationId)?.title ?? "New chat";

  async function refreshDocuments() {
    try {
      setDocuments(await listDocuments());
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function refreshConversations() {
    try {
      setConversations(await listConversations());
    } catch (e) {
      setError(messageOf(e));
    }
  }

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((e: unknown) => setError(messageOf(e)));
    listConversations()
      .then(setConversations)
      .catch((e: unknown) => setError(messageOf(e)));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function closeSidebarOnMobile() {
    if (isMobile()) setSidebarOpen(false);
  }

  function resetChat() {
    setConversationId(null);
    setDocumentId(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  function newChat() {
    if (busy) return;
    resetChat();
    closeSidebarOnMobile();
  }

  function selectDocument(id: number) {
    if (busy) return;
    setDocumentId(id);
    setConversationId(null);
    setMessages([]);
    setError("");
    closeSidebarOnMobile();
  }

  async function openConversation(id: number) {
    if (busy) return;
    if (id === conversationId) {
      closeSidebarOnMobile();
      return;
    }
    setError("");
    try {
      const conv = await getConversation(id);
      setConversationId(conv.id);
      setDocumentId(conv.document_id);
      setMessages(
        conv.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
        }))
      );
      closeSidebarOnMobile();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function removeConversation(c: Conversation) {
    if (busy) return;
    if (!window.confirm(`Delete this chat?\n\n"${c.title}"`)) return;
    try {
      await deleteConversation(c.id);
      if (c.id === conversationId) resetChat();
      await refreshConversations();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function removeDocument(d: DocumentInfo) {
    if (busy) return;
    const ok = window.confirm(
      `Delete "${d.filename}" and its indexed text?\n\nChats about it stay in your history but can no longer search it.`
    );
    if (!ok) return;
    try {
      await deleteDocument(d.id);
      if (d.id === documentId) resetChat();
      await refreshDocuments();
      await refreshConversations();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function handleFile(file: File) {
    if (busy || uploading) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const doc = await uploadDocument(file);
      await refreshDocuments();
      // a conversation is tied to one document, so uploading starts a new chat
      setDocumentId(doc.id);
      setConversationId(null);
      setMessages([]);
      closeSidebarOnMobile();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setUploading(false);
    }
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
    if (!text || busy || uploading) return;

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
      void refreshConversations(); // picks up the new chat and its title
    }
  }

  return (
    <div className={`shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        documents={documents}
        activeConversationId={conversationId}
        activeDocumentId={documentId}
        uploading={uploading}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onSelectConversation={openConversation}
        onDeleteConversation={removeConversation}
        onSelectDocument={selectDocument}
        onDeleteDocument={removeDocument}
        onFile={handleFile}
      />

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <MenuIcon />
          </button>
          <div className="topbar-title">{title}</div>
          {activeDocument && (
            <span className="chip">
              <FileIcon width={14} height={14} />
              <span className="chip-name">{activeDocument.filename}</span>
            </span>
          )}
        </header>

        <div className="scroll">
          <div className="thread">
            {messages.length === 0 ? (
              <div className="empty">
                <div className="empty-logo">📚</div>
                <h2>
                  {activeDocument
                    ? `Chat with ${activeDocument.filename}`
                    : "How can I help you today?"}
                </h2>
                <p>
                  {activeDocument
                    ? "Ask a specific question. Answers cite the pages they come from."
                    : "Ask anything, or click the paperclip to upload a PDF and chat with it."}
                </p>
              </div>
            ) : (
              messages.map((m, i) => <Message key={i} message={m} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={submit}
          busy={busy}
          uploading={uploading}
          activeDocument={activeDocument}
          canDetach={messages.length === 0 && activeDocument !== null}
          onDetach={() => setDocumentId(null)}
          onFile={handleFile}
        />
      </div>
    </div>
  );
}