import type { UploadQueueItem } from "../shared/types/upload.types";

const BADGE: Record<UploadQueueItem["status"], string> = {
  done: "bg-success/20 text-success",
  duplicate: "bg-warning/20 text-warning",
  error: "bg-danger/20 text-danger",
  uploading: "bg-accent/20 text-accent",
  pending: "bg-surface-2 text-faint",
};

const GLYPH: Record<UploadQueueItem["status"], string> = {
  done: "✓",
  duplicate: "=",
  error: "✗",
  uploading: "↑",
  pending: "·",
};

interface UploadItemProps {
  item: UploadQueueItem;
  onRetry: (id: string) => void;
}

export const UploadItem = ({ item, onRetry }: UploadItemProps) => (
  <div className="px-4 py-2.5 flex items-center gap-3">
    <div
      className={`shrink-0 w-7 h-7 rounded-[7px] flex items-center justify-center text-xs font-bold ${BADGE[item.status]}`}
    >
      {GLYPH[item.status]}
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-muted truncate">
        {item.file.name}
      </p>

      {item.status === "uploading" && (
        <div className="mt-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
      {item.status === "done" && (
        <p className="text-[10px] text-success mt-0.5">Uploaded</p>
      )}
      {item.status === "duplicate" && (
        <p className="text-[10px] text-warning mt-0.5 truncate">
          Already exists{item.duplicate ? ` · ${item.duplicate}` : ""}
        </p>
      )}
      {item.status === "error" && (
        <p className="text-[10px] text-danger mt-0.5">
          {item.error ?? "Unknown error"}
        </p>
      )}
      {item.status === "pending" && (
        <p className="text-[10px] text-faint mt-0.5">Waiting…</p>
      )}
    </div>

    {item.status === "error" && (
      <button
        onClick={() => onRetry(item.id)}
        className="shrink-0 text-[10px] font-bold text-accent hover:text-accent-hover px-2 py-1 bg-accent/10 rounded-[7px] transition-colors"
      >
        Retry
      </button>
    )}

    {item.status === "uploading" && (
      <span className="shrink-0 text-[10px] font-bold text-faint w-8 text-right">
        {item.progress}%
      </span>
    )}
  </div>
);
