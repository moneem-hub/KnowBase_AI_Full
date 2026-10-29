import type { Conversation, DocumentInfo } from "../api";
import { FileIcon, PlusIcon, TrashIcon } from "./Icons";
import UploadButton from "./UploadButton";

interface Props {
  open: boolean;
  conversations: Conversation[];
  documents: DocumentInfo[];
  activeConversationId: number | null;
  activeDocumentId: number | null;
  uploading: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (c: Conversation) => void;
  onSelectDocument: (id: number) => void;
  onDeleteDocument: (d: DocumentInfo) => void;
  onFile: (file: File) => void;
}

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"];

function groupLabel(iso: string): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  return "Older";
}

export default function Sidebar(p: Props) {
  const groups = new Map<string, Conversation[]>();
  for (const c of p.conversations) {
    const label = groupLabel(c.created_at);
    groups.set(label, [...(groups.get(label) ?? []), c]);
  }

  return (
    <>
      {p.open && <div className="backdrop" onClick={p.onClose} />}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">📚 KnowBase AI</div>
          <button className="new-chat" onClick={p.onNewChat}>
            <PlusIcon /> New chat
          </button>
        </div>

        <section className="side-section chats">
          <div className="side-head">
            <h3>Chats</h3>
          </div>
          <div className="list">
            {p.conversations.length === 0 && (
              <p className="hint">Your conversations will appear here.</p>
            )}
            {GROUP_ORDER.filter((l) => groups.has(l)).map((label) => (
              <div key={label}>
                <div className="group-label">{label}</div>
                {(groups.get(label) ?? []).map((c) => (
                  <div
                    key={c.id}
                    className={`item ${c.id === p.activeConversationId ? "active" : ""}`}
                  >
                    <button
                      className="item-main"
                      title={c.title}
                      onClick={() => p.onSelectConversation(c.id)}
                    >
                      <span>{c.title}</span>
                    </button>
                    <button
                      className="item-delete"
                      aria-label="Delete chat"
                      onClick={() => p.onDeleteConversation(c)}
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="side-section docs">
          <div className="side-head">
            <h3>Documents</h3>
            <UploadButton
              className="link-btn"
              onFile={p.onFile}
              disabled={p.uploading}
            >
              + Upload
            </UploadButton>
          </div>
          <div className="list">
            {p.documents.length === 0 && (
              <p className="hint">
                No documents yet. Upload a PDF to chat with it.
              </p>
            )}
            {p.documents.map((d) => (
              <div
                key={d.id}
                className={`item ${d.id === p.activeDocumentId ? "active" : ""}`}
              >
                <button
                  className="item-main"
                  title={`${d.filename} · ${d.page_count} pages`}
                  onClick={() => p.onSelectDocument(d.id)}
                >
                  <FileIcon width={15} height={15} />
                  <span>{d.filename}</span>
                </button>
                <button
                  className="item-delete"
                  aria-label="Delete document"
                  onClick={() => p.onDeleteDocument(d)}
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </>
  );
}