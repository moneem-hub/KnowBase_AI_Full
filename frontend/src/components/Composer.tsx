import { useEffect, useRef, type KeyboardEvent } from "react";
import type { DocumentInfo } from "../api";
import { CloseIcon, FileIcon, PaperclipIcon, SendIcon } from "./Icons";
import UploadButton from "./UploadButton";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  uploading: boolean;
  activeDocument: DocumentInfo | null;
  canDetach: boolean;
  onDetach: () => void;
  onFile: (file: File) => void;
}

export default function Composer(p: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // grow the box with the text, up to a limit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [p.value]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      p.onSubmit();
    }
  }

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          p.onSubmit();
        }}
      >
        {(p.uploading || p.activeDocument) && (
          <div className="chips">
            {p.uploading ? (
              <span className="chip">
                <span className="spinner" /> Processing PDF… the first upload can
                take a minute
              </span>
            ) : (
              p.activeDocument && (
                <span className="chip">
                  <FileIcon width={14} height={14} />
                  <span className="chip-name">{p.activeDocument.filename}</span>
                  {p.canDetach && (
                    <button
                      type="button"
                      aria-label="Remove document"
                      onClick={p.onDetach}
                    >
                      <CloseIcon width={14} height={14} />
                    </button>
                  )}
                </span>
              )
            )}
          </div>
        )}

        <div className="composer-row">
          <UploadButton
            className="icon-btn"
            title="Upload a PDF (starts a new chat)"
            onFile={p.onFile}
            disabled={p.busy || p.uploading}
          >
            <PaperclipIcon />
          </UploadButton>

          <textarea
            ref={ref}
            rows={1}
            value={p.value}
            onChange={(e) => p.onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              p.activeDocument
                ? "Ask about the document…"
                : "Message KnowBase AI…"
            }
            disabled={p.busy}
          />

          <button
            type="submit"
            className="send"
            aria-label="Send"
            disabled={p.busy || p.uploading || !p.value.trim()}
          >
            <SendIcon />
          </button>
        </div>
      </form>
      <p className="disclaimer">
        With a document selected, answers come only from that document. Check
        important details.
      </p>
    </div>
  );
}