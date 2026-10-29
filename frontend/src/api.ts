export const API: string =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface Source {
  chunk_id: number;
  document_id: number;
  source: string;
  page: number;
  text: string;
  score: number;
}

export interface DocumentInfo {
  id: number;
  filename: string;
  page_count: number;
  chunk_count: number;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  document_id: number | null;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
}

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "done"; message_id: number }
  | { type: "error"; detail: string };

export interface StreamHandlers {
  onSources?: (sources: Source[]) => void;
  onToken?: (text: string) => void;
  onDone?: (messageId: number) => void;
  onError?: (detail: string) => void;
}

const NETWORK_ERROR =
  "Cannot reach the API. Is the backend running on port 8000?";

function toMessage(detail: unknown, fallback: string): string {
  if (!detail) return fallback;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

async function errorFrom(res: Response): Promise<Error> {
  let detail: unknown = null;
  try {
    detail = (await res.json()).detail;
  } catch {
    /* response had no JSON body */
  }
  return new Error(toMessage(detail, res.statusText));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw await errorFrom(res);
  return (res.status === 204 ? null : await res.json()) as T;
}

export const listDocuments = () => request<DocumentInfo[]>("/documents");

export const createConversation = (documentId: number | null) =>
  request<Conversation>("/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });

// Reads the Server-Sent Events stream from Step 8 and calls a handler per event.
export async function streamMessage(
  conversationId: number,
  content: string,
  handlers: StreamHandlers
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new Error("The server sent an empty response.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; keep any partial event in the buffer.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6)) as StreamEvent;
      if (event.type === "sources") handlers.onSources?.(event.sources);
      else if (event.type === "token") handlers.onToken?.(event.text);
      else if (event.type === "done") handlers.onDone?.(event.message_id);
      else if (event.type === "error") handlers.onError?.(event.detail);
    }
  }
}

export interface ApiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ApiMessage[];
}

export const uploadDocument = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<DocumentInfo>("/documents", { method: "POST", body: form });
};

export const deleteDocument = (id: number) =>
  request<null>(`/documents/${id}`, { method: "DELETE" });

export const listConversations = () => request<Conversation[]>("/conversations");

export const getConversation = (id: number) =>
  request<ConversationDetail>(`/conversations/${id}`);

export const deleteConversation = (id: number) =>
  request<null>(`/conversations/${id}`, { method: "DELETE" });