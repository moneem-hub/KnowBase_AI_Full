import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../api";

export default function Message({ message }: { message: ChatMessage }) {
  const { role, content, sources = [], streaming } = message;
  const pages = [...new Set(sources.map((s) => s.page))].sort((a, b) => a - b);

  return (
    <div className={`row ${role}`}>
      <div className="bubble">
        {role === "assistant" ? (
          content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <span className="typing">Thinking…</span>
          )
        ) : (
          <p>{content}</p>
        )}

        {streaming && content && <span className="cursor" />}

        {sources.length > 0 && !streaming && (
          <details className="sources">
            <summary>Sources: page {pages.join(", ")}</summary>
            {sources.map((s) => (
              <div key={s.chunk_id} className="source">
                <strong>Page {s.page}</strong> · relevance {s.score.toFixed(2)}
                <p>
                  {s.text.slice(0, 300)}
                  {s.text.length > 300 ? "…" : ""}
                </p>
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}