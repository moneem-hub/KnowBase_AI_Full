import { useRef, type ReactNode } from "react";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}

export default function UploadButton({
  onFile,
  disabled,
  className,
  title,
  children,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        title={title}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // lets the same file be chosen again
          if (file) onFile(file);
        }}
      />
    </>
  );
}