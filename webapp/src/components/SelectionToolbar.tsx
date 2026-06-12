import { CloseIcon, DownloadIcon } from "./icons";

interface SelectionToolbarProps {
  count: number;
  onClear: () => void;
  onSelectAll: () => void;
  onDownload: () => void;
}

export const SelectionToolbar = ({
  count,
  onClear,
  onSelectAll,
  onDownload,
}: SelectionToolbarProps) => (
  <div
    className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2.5 bg-surface border border-white/12 rounded-[var(--radius-card)] shadow-2xl"
    style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
  >
    <button
      onClick={onClear}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-[11px] font-bold text-muted hover:text-content transition-colors"
    >
      <CloseIcon className="w-3.5 h-3.5" />
      {count} selected
    </button>

    <div className="w-px h-5 bg-white/12" />

    <button
      onClick={onSelectAll}
      className="px-3 py-1.5 rounded-[var(--radius-control)] text-[11px] font-bold text-muted hover:text-content transition-colors"
    >
      All
    </button>

    <div className="w-px h-5 bg-white/12" />

    <button
      onClick={onDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-[11px] font-bold text-accent hover:text-accent-hover transition-colors"
    >
      <DownloadIcon className="w-3.5 h-3.5" />
      Save
    </button>
  </div>
);
