import {
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getMediaUrl } from "../route/config";
import { GalleryItem } from "../components/GalleryItem";
import { FilterTabs, type MediaFilter } from "../components/FilterTabs";
import { DateNav } from "../components/DateNav";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { RefreshIcon, UploadsIcon } from "../components/icons";
import { MediaViewer } from "./MediaViewer";
import type { EnhancedMediaRecord } from "../shared/types/media.types";

interface GalleryScreenProps {
  media: EnhancedMediaRecord[];
  loading: boolean;
  refresh: () => void;
  uploadCount: number;
  onOpenUploads: () => void;
}

export const GalleryScreen = ({
  media,
  loading,
  refresh,
  uploadCount,
  onOpenUploads,
}: GalleryScreenProps) => {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [visibleCount, setVisibleCount] = useState(120);
  const [activeMedia, setActiveMedia] = useState<EnhancedMediaRecord | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectMode = selected.size > 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const dateRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useLayoutEffect(() => {
    const chrome = chromeRef.current;
    const root = rootRef.current;
    if (!chrome || !root) return;
    const update = () =>
      root.style.setProperty("--chrome-h", `${chrome.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(chrome);
    return () => observer.disconnect();
  }, []);

  const toggleSelect = useCallback((filename: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);
  const clearSelect = useCallback(() => setSelected(new Set()), []);
  const openMedia = useCallback(
    (rec: EnhancedMediaRecord) => setActiveMedia(rec),
    [],
  );

  const deferredFilter = useDeferredValue(filter);
  const deferredCount = useDeferredValue(visibleCount);

  const { filteredList, groupedGroups, allUniqueDates, totalFiltered } =
    useMemo(() => {
      const filtered = media.filter(
        (m) => deferredFilter === "all" || m.type === deferredFilter,
      );
      const dateOrder: string[] = [];
      const seenDates = new Set<string>();
      const groups: Record<string, EnhancedMediaRecord[]> = {};
      let count = 0;

      for (const item of filtered) {
        if (!seenDates.has(item.dateGroup)) {
          seenDates.add(item.dateGroup);
          dateOrder.push(item.dateGroup);
        }
        if (count < deferredCount) {
          if (!groups[item.dateGroup]) groups[item.dateGroup] = [];
          groups[item.dateGroup].push(item);
          count++;
        }
      }

      return {
        filteredList: filtered.slice(0, deferredCount),
        groupedGroups: groups,
        allUniqueDates: dateOrder,
        totalFiltered: filtered.length,
      };
    }, [media, deferredFilter, deferredCount]);

  const selectAll = useCallback(
    () => setSelected(new Set(filteredList.map((m) => m.filename))),
    [filteredList],
  );

  const scrollToDate = (date: string) => {
    const target = dateRefs.current[date];
    if (!target) return;
    const chromeH = chromeRef.current?.offsetHeight ?? 0;
    const top =
      target.getBoundingClientRect().top + window.pageYOffset - chromeH - 8;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const downloadSelected = async () => {
    const items = filteredList.filter((m) => selected.has(m.filename));
    for (const item of items) {
      const res = await fetch(getMediaUrl(item));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const { photoCount, videoCount } = useMemo(
    () => ({
      photoCount: media.filter((m) => m.type === "photo").length,
      videoCount: media.filter((m) => m.type === "video").length,
    }),
    [media],
  );

  return (
    <div
      ref={rootRef}
      className="bg-bg text-muted flex flex-col font-sans antialiased selection:bg-accent/40"
      style={{ minHeight: "100dvh" }}
    >
      <div ref={chromeRef} className="sticky top-0 z-40">
        <header
          className="bg-surface-2 border-b border-white/8 px-4 flex justify-between items-center"
          style={{
            paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
            paddingBottom: "0.75rem",
          }}
        >
          <div>
            <h1 className="text-base font-bold tracking-tight text-content">
              Library
            </h1>
            <p className="text-[10px] font-semibold text-faint">
              {media.length > 0
                ? `${photoCount} photos · ${videoCount} videos`
                : "Family Server"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-3 border border-white/10 rounded-[var(--radius-control)] text-success transition-colors"
            >
              <RefreshIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-bold">Refresh</span>
            </button>

            <button
              onClick={onOpenUploads}
              className="relative flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-3 border border-white/10 rounded-[var(--radius-control)] text-accent transition-colors"
            >
              <UploadsIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-bold">Uploads</span>
              {uploadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-accent text-white text-[9px] font-bold rounded-full">
                  {uploadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="bg-bg pt-3 pb-3.5 border-b border-white/8 flex flex-col gap-3">
          <FilterTabs
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setVisibleCount(120);
            }}
          />
          <DateNav dates={allUniqueDates} onSelect={scrollToDate} />
        </div>
      </div>

      <main
        className="flex-1 flex flex-col max-w-4xl w-full mx-auto pb-32"
        style={{ overscrollBehavior: "none" }}
      >
        {loading ? (
          <div className="p-16 text-center text-faint text-xs font-semibold tracking-wider animate-pulse">
            Loading media...
          </div>
        ) : totalFiltered === 0 ? (
          <div className="p-16 text-center text-faint text-xs border border-dashed border-white/10 m-4 rounded-[var(--radius-card)]">
            No media yet
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-4 mt-4">
            {Object.keys(groupedGroups).map((date) => (
              <div key={date} className="flex flex-col gap-2">
                <div
                  ref={(el) => {
                    dateRefs.current[date] = el;
                  }}
                  className="sticky bg-bg py-2 z-10 flex justify-between items-center border-b border-white/6"
                  style={{ top: "var(--chrome-h, 7rem)" }}
                >
                  <h2 className="text-xs font-bold text-muted uppercase tracking-widest">
                    {date}
                  </h2>
                  <span className="text-[10px] font-bold text-faint bg-surface px-2 py-0.5 rounded-md border border-white/8">
                    {groupedGroups[date].length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {groupedGroups[date].map((rec) => (
                    <GalleryItem
                      key={rec.filename}
                      rec={rec}
                      selected={selected.has(rec.filename)}
                      selectMode={selectMode}
                      onOpen={openMedia}
                      onToggle={toggleSelect}
                    />
                  ))}
                </div>
              </div>
            ))}

            {totalFiltered > visibleCount && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 60)}
                className="mt-8 mx-auto px-6 py-2.5 bg-surface hover:bg-surface-2 border border-white/10 rounded-[var(--radius-control)] text-xs font-bold tracking-wide text-muted transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </main>

      {selectMode && (
        <SelectionToolbar
          count={selected.size}
          onClear={clearSelect}
          onSelectAll={selectAll}
          onDownload={downloadSelected}
        />
      )}

      <MediaViewer
        items={filteredList}
        activeMedia={activeMedia}
        onChange={setActiveMedia}
      />
    </div>
  );
};
