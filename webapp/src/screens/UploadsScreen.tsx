import { useRef } from "react";
import { UploadItem } from "../components/UploadItem";
import { BackIcon, PlusIcon } from "../components/icons";
import type { UploadQueueItem } from "../shared/types/upload.types";

interface UploadsScreenProps {
  queue: UploadQueueItem[];
  onAddFiles: (files: FileList | null) => void;
  onRetry: (id: string) => void;
  onDismiss: () => void;
  onBack: () => void;
}

const summarize = (queue: UploadQueueItem[]) => {
  const done = queue.filter(
    (x) => x.status === "done" || x.status === "duplicate",
  ).length;
  const total = queue.length;
  const active = queue.filter((x) => x.status === "uploading").length;
  if (active > 0) return `Uploading ${done}/${total}`;
  if (done === total) return `${total} file${total > 1 ? "s" : ""} processed`;
  return `${done}/${total} done`;
};

export const UploadsScreen = ({
  queue,
  onAddFiles,
  onRetry,
  onDismiss,
  onBack,
}: UploadsScreenProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const settled =
    queue.length > 0 &&
    queue.every((x) => ["done", "duplicate", "error"].includes(x.status));

  return (
    <div
      className="bg-bg text-muted flex flex-col font-sans antialiased"
      style={{ minHeight: "100dvh" }}
    >
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        ref={inputRef}
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <header
        className="bg-surface-2 border-b border-white/8 sticky top-0 z-40 px-4 flex justify-between items-center"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-muted hover:text-content transition-colors"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-content">
              Uploads
            </h1>
            <p className="text-[10px] font-semibold text-faint">
              {queue.length > 0 ? summarize(queue) : "No uploads yet"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settled && (
            <button
              onClick={onDismiss}
              className="px-2 py-2 text-[11px] font-bold text-faint hover:text-muted transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-3 border border-white/10 rounded-[var(--radius-control)] text-accent transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-bold">Add files</span>
          </button>
        </div>
      </header>

      <main
        className="flex-1 flex flex-col max-w-2xl w-full mx-auto"
        style={{ overscrollBehavior: "none" }}
      >
        {queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-16 text-center">
            <p className="text-faint text-xs">No uploads in progress</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-[var(--radius-control)] transition-colors"
            >
              Select files
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {queue.map((item) => (
              <UploadItem key={item.id} item={item} onRetry={onRetry} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
