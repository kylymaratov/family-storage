import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { API_BASE_URL, getMediaUrl } from "./shared/config";
import type { MediaRecord } from "./shared/types";

interface UploadQueueItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "duplicate" | "error";
  progress: number;
  error?: string;
  duplicate?: string;
}

interface EnhancedMediaRecord extends MediaRecord {
  dateGroup: string;
}

const formatDateGroup = (createdAt: number): string => {
  const date = new Date(createdAt * 1000);
  if (!createdAt || Number.isNaN(date.getTime())) return "Unknown date";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const LazyMediaCard = React.memo(
  ({
    rec,
    onClick,
    onLongPress,
    selected,
    selectMode,
  }: {
    rec: EnhancedMediaRecord;
    onClick: () => void;
    onLongPress: () => void;
    selected: boolean;
    selectMode: boolean;
  }) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        },
        { rootMargin: "350px" },
      );
      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
    }, []);

    const handlePressStart = useCallback(() => {
      pressTimer.current = setTimeout(() => {
        pressTimer.current = null;
        onLongPress();
      }, 500);
    }, [onLongPress]);
    const handlePressEnd = useCallback(() => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
        onClick();
      }
    }, [onClick]);
    const handlePressCancel = useCallback(() => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }, []);

    return (
      <div
        ref={ref}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressCancel}
        onPointerCancel={handlePressCancel}
        className={`aspect-square bg-[#242424] rounded-2xl overflow-hidden relative transition-all duration-200 ease-out cursor-pointer border shadow-sm
          ${selected ? "border-indigo-500 scale-95 brightness-75" : "border-[#303030] active:scale-95 sm:hover:scale-[1.03]"}
          ${selectMode ? "" : "group"}`}
      >
        {isIntersecting ? (
          rec.type === "photo" ? (
            <img
              src={getMediaUrl(rec)}
              alt="Media asset"
              loading="lazy"
              draggable={false}
              onLoad={() => setIsLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-300 ease-out ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] transition-colors duration-300 group-hover:bg-[#282828]">
              <div className="p-3 bg-[#303030]/90 rounded-full border border-[#404040]/50 text-indigo-400 shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
                </svg>
              </div>
            </div>
          )
        ) : (
          <div className="w-full h-full bg-[#202020] relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#2d2d2d]/40 to-transparent animate-shimmer" />
          </div>
        )}

        {rec.type === "video" && (
          <div className="absolute bottom-2 right-2 bg-[#1e1e1e]/60 px-2 py-0.5 rounded-lg text-[9px] text-[#e0e0e0] font-bold uppercase tracking-wider backdrop-blur-md border border-[#ffffff]/05">
            Video
          </div>
        )}

        {selectMode && (
          <div
            className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150
            ${selected ? "bg-indigo-500 border-indigo-500" : "bg-black/30 border-white/60"}`}
          >
            {selected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    );
  },
);

LazyMediaCard.displayName = "LazyMediaCard";

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("family_token"),
  );
  const [tokenInput, setTokenInput] = useState("");

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const [media, setMedia] = useState<EnhancedMediaRecord[]>([]);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [visibleCount, setVisibleCount] = useState(120);
  const [activeMedia, setActiveMedia] = useState<EnhancedMediaRecord | null>(
    null,
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectMode = selected.size > 0;

  const toggleSelect = useCallback((filename: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);
  const clearSelect = useCallback(() => setSelected(new Set()), []);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  const dateRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const touchStart = useRef({ x: 0, y: 0 });
  const gesture = useRef<"none" | "horizontal" | "vertical" | "pinch">("none");
  const dragX = useRef(0);
  const dragY = useRef(0);

  const zoom = useRef(1);
  const zoomOrigin = useRef({ x: 0.5, y: 0.5 });
  const panOffset = useRef({ x: 0, y: 0 });
  const pinchStart = useRef(0);
  const pinchZoomStart = useRef(1);

  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveToast, setSaveToast] = useState<
    "saving" | "saved" | "error" | null
  >(null);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  const isAnimating = useRef(false);

  const { filteredList, groupedGroups, allUniqueDates, totalFiltered } =
    useMemo(() => {
      const filtered = media.filter(
        (m) => filter === "all" || m.type === filter,
      );
      const totalFiltered = filtered.length;

      const dateOrder: string[] = [];
      const seenDates = new Set<string>();
      const groups: Record<string, EnhancedMediaRecord[]> = {};
      let count = 0;

      for (const item of filtered) {
        if (!seenDates.has(item.dateGroup)) {
          seenDates.add(item.dateGroup);
          dateOrder.push(item.dateGroup);
        }
        if (count < visibleCount) {
          if (!groups[item.dateGroup]) groups[item.dateGroup] = [];
          groups[item.dateGroup].push(item);
          count++;
        }
      }

      return {
        filteredList: filtered.slice(0, visibleCount),
        groupedGroups: groups,
        allUniqueDates: dateOrder,
        totalFiltered,
      };
    }, [media, filter, visibleCount]);

  const selectAll = useCallback(
    () => setSelected(new Set(filteredList.map((m) => m.filename))),
    [filteredList],
  );

  const activeIndex = useMemo(() => {
    if (!activeMedia) return -1;
    return filteredList.findIndex((m) => m.filename === activeMedia.filename);
  }, [activeMedia, filteredList]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) setActiveMedia(filteredList[activeIndex - 1]);
  }, [activeIndex, filteredList]);
  const handleNext = useCallback(() => {
    if (activeIndex < filteredList.length - 1)
      setActiveMedia(filteredList[activeIndex + 1]);
  }, [activeIndex, filteredList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeIndex === -1) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setActiveMedia(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredList]);

  const viewerOpen = activeMedia !== null;
  useEffect(() => {
    if (!viewerOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [viewerOpen]);

  const applyDrag = (x: number, y: number) => {
    const absY = Math.abs(y);
    const scale = absY > 0 ? Math.max(0.78, 1 - absY / 1100) : 1;
    const opacity = absY > 0 ? Math.max(0.15, 0.98 - absY / 500) : 0.98;
    const uiOpacity = absY > 0 ? Math.max(0, 1 - absY / 200) : 1;

    const cur = slideRefs.current[1];
    if (cur)
      cur.style.transform =
        x !== 0 || y !== 0 || scale !== 1
          ? `translate(${x}px,${y}px) scale(${scale})`
          : "none";

    const prev = slideRefs.current[0];
    if (prev)
      prev.style.transform =
        x !== 0 ? `translateX(calc(-100% + ${x}px))` : "translateX(-100%)";
    const next = slideRefs.current[2];
    if (next)
      next.style.transform =
        x !== 0 ? `translateX(calc(100% + ${x}px))` : "translateX(100%)";

    if (backdropRef.current)
      backdropRef.current.style.backgroundColor = `rgba(0,0,0,${opacity})`;
    if (topBarRef.current)
      topBarRef.current.style.opacity =
        uiOpacity === 1 ? "1" : String(uiOpacity);
    if (bottomBarRef.current)
      bottomBarRef.current.style.opacity =
        uiOpacity === 1 ? "1" : String(uiOpacity);
  };

  const snapBack = () => {
    isAnimating.current = true;
    const SPRING = "0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = `transform ${SPRING}`;
      el.style.transform =
        i === 0
          ? "translateX(-100%)"
          : i === 2
            ? "translateX(100%)"
            : "translate(0,0) scale(1)";
    });
    if (backdropRef.current) {
      backdropRef.current.style.transition = `background-color 0.25s ease`;
      backdropRef.current.style.backgroundColor = "rgba(0,0,0,0.98)";
    }
    if (topBarRef.current) {
      topBarRef.current.style.transition = "opacity 0.2s";
      topBarRef.current.style.opacity = "1";
    }
    if (bottomBarRef.current) {
      bottomBarRef.current.style.transition = "opacity 0.2s";
      bottomBarRef.current.style.opacity = "1";
    }
    setTimeout(() => {
      isAnimating.current = false;
    }, 380);
  };

  const slideOut = (
    direction: "left" | "right" | "up" | "down",
    onDone: () => void,
  ) => {
    isAnimating.current = true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const DUR = 260;
    const EASE = `${DUR}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    const cur = slideRefs.current[1];
    const prev = slideRefs.current[0];
    const next = slideRefs.current[2];

    if (direction === "left") {
      if (cur) {
        cur.style.transition = `transform ${EASE}`;
        cur.style.transform = `translateX(${-w}px)`;
      }
      if (next) {
        next.style.transition = `transform ${EASE}`;
        next.style.transform = "translateX(0)";
      }
    } else if (direction === "right") {
      if (cur) {
        cur.style.transition = `transform ${EASE}`;
        cur.style.transform = `translateX(${w}px)`;
      }
      if (prev) {
        prev.style.transition = `transform ${EASE}`;
        prev.style.transform = "translateX(0)";
      }
    } else {
      if (cur) {
        cur.style.transition = `transform ${EASE}, opacity ${EASE}`;
        cur.style.transform = `translateY(${direction === "up" ? -h : h}px) scale(0.82)`;
        (cur as HTMLElement).style.opacity = "0";
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = `background-color ${EASE}`;
        backdropRef.current.style.backgroundColor = "rgba(0,0,0,0)";
      }
    }

    setTimeout(() => {
      slideRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transition = "none";
        el.style.opacity = "1";
      });
      const [s0, s1, s2] = slideRefs.current;
      if (s0) s0.style.transform = "translateX(-100%)";
      if (s1) s1.style.transform = "translateX(0)";
      if (s2) s2.style.transform = "translateX(100%)";
      if (s1) s1.style.opacity = "0";
      isAnimating.current = false;
      dragX.current = 0;
      dragY.current = 0;
      gesture.current = "none";
      onDone();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const s1 = slideRefs.current[1];
          if (s1) {
            s1.style.transition = "opacity 0.15s ease";
            s1.style.opacity = "1";
          }
        });
      });
    }, DUR + 20);
  };

  const applyZoom = (
    scale: number,
    ox: number,
    oy: number,
    px: number,
    py: number,
    animated = false,
  ) => {
    const img = imgRef.current;
    if (!img) return;
    if (animated)
      img.style.transition =
        "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    else img.style.transition = "none";
    img.style.transformOrigin = `${ox * 100}% ${oy * 100}%`;
    img.style.transform = `translate(${px}px, ${py}px) scale(${scale})`;
  };

  const resetZoom = (animated = true) => {
    zoom.current = 1;
    panOffset.current = { x: 0, y: 0 };
    zoomOrigin.current = { x: 0.5, y: 0.5 };
    applyZoom(1, 0.5, 0.5, 0, 0, animated);
  };

  const isZoomed = () => zoom.current > 1.05;

  useEffect(() => {
    resetZoom(false);
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveImage = async (item: EnhancedMediaRecord) => {
    if (item.type !== "photo") return;
    setSaveToast("saving");
    try {
      const url = getMediaUrl(item);
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      setSaveToast("saved");
    } catch {
      setSaveToast("error");
    }
    setTimeout(() => setSaveToast(null), 2000);
  };

  const pinchDist = (e: React.TouchEvent) => {
    const [a, b] = [e.targetTouches[0], e.targetTouches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating.current) return;

    if (e.targetTouches.length === 2) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      gesture.current = "pinch";
      pinchStart.current = pinchDist(e);
      pinchZoomStart.current = zoom.current;
      return;
    }

    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
    gesture.current = "none";
    dragX.current = 0;
    dragY.current = 0;

    slideRefs.current.forEach((el) => {
      if (el) el.style.transition = "none";
    });
    if (backdropRef.current) backdropRef.current.style.transition = "none";
    if (topBarRef.current) topBarRef.current.style.transition = "none";
    if (bottomBarRef.current) bottomBarRef.current.style.transition = "none";

    const item = filteredList[activeIndex];
    if (item?.type === "photo") {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (gesture.current === "none") saveImage(item);
      }, 600);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnimating.current) return;

    if (e.targetTouches.length === 2 && gesture.current === "pinch") {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      const dist = pinchDist(e);
      const scale = Math.min(
        5,
        Math.max(1, pinchZoomStart.current * (dist / pinchStart.current)),
      );
      const img = imgRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        const mx =
          (e.targetTouches[0].clientX + e.targetTouches[1].clientX) / 2;
        const my =
          (e.targetTouches[0].clientY + e.targetTouches[1].clientY) / 2;
        zoomOrigin.current = {
          x: Math.max(0, Math.min(1, (mx - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (my - rect.top) / rect.height)),
        };
      }
      zoom.current = scale;
      applyZoom(
        scale,
        zoomOrigin.current.x,
        zoomOrigin.current.y,
        panOffset.current.x,
        panOffset.current.y,
      );
      return;
    }

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const dx = e.targetTouches[0].clientX - touchStart.current.x;
    const dy = e.targetTouches[0].clientY - touchStart.current.y;

    if (gesture.current === "none") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (isZoomed()) {
        gesture.current = "vertical";
        return;
      }
      gesture.current = Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
    }

    if (isZoomed()) {
      panOffset.current = {
        x: panOffset.current.x + dx * 0.5,
        y: panOffset.current.y + dy * 0.5,
      };
      touchStart.current = {
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY,
      };
      applyZoom(
        zoom.current,
        zoomOrigin.current.x,
        zoomOrigin.current.y,
        panOffset.current.x,
        panOffset.current.y,
      );
      return;
    }

    if (gesture.current === "horizontal") {
      const atStart = activeIndex === 0;
      const atEnd = activeIndex === filteredList.length - 1;
      const limited =
        atStart && dx > 0 ? dx * 0.2 : atEnd && dx < 0 ? dx * 0.2 : dx;
      dragX.current = limited;
      applyDrag(limited, 0);
    } else {
      dragY.current = dy;
      applyDrag(0, dy);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isAnimating.current) return;

    if (gesture.current === "pinch") {
      gesture.current = "none";
      if (zoom.current < 1.1) resetZoom(true);
      return;
    }

    const dx = dragX.current;
    const dy = dragY.current;

    if (gesture.current === "none") {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (tapTimer.current) {
          clearTimeout(tapTimer.current);
          tapTimer.current = null;
        }
        lastTap.current = 0;
        if (isZoomed()) {
          resetZoom(true);
        } else {
          const img = imgRef.current;
          if (img) {
            const rect = img.getBoundingClientRect();
            const tx = e.changedTouches[0].clientX;
            const ty = e.changedTouches[0].clientY;
            zoomOrigin.current = {
              x: Math.max(0, Math.min(1, (tx - rect.left) / rect.width)),
              y: Math.max(0, Math.min(1, (ty - rect.top) / rect.height)),
            };
          }
          zoom.current = 2.5;
          applyZoom(
            2.5,
            zoomOrigin.current.x,
            zoomOrigin.current.y,
            0,
            0,
            true,
          );
        }
      } else {
        lastTap.current = now;
      }
      dragX.current = 0;
      dragY.current = 0;
      gesture.current = "none";
      return;
    }

    if (isZoomed()) {
      dragX.current = 0;
      dragY.current = 0;
      gesture.current = "none";
      return;
    }

    const SWIPE_X = window.innerWidth * 0.32;
    const SWIPE_Y = window.innerHeight * 0.22;

    if (gesture.current === "horizontal") {
      if (dx < -SWIPE_X && activeIndex < filteredList.length - 1) {
        resetZoom(false);
        slideOut("left", () => handleNext());
      } else if (dx > SWIPE_X && activeIndex > 0) {
        resetZoom(false);
        slideOut("right", () => handlePrev());
      } else {
        dragX.current = 0;
        dragY.current = 0;
        gesture.current = "none";
        snapBack();
      }
    } else if (gesture.current === "vertical") {
      if (Math.abs(dy) > SWIPE_Y) {
        resetZoom(false);
        slideOut(dy < 0 ? "up" : "down", () => setActiveMedia(null));
      } else {
        dragX.current = 0;
        dragY.current = 0;
        gesture.current = "none";
        snapBack();
      }
    } else {
      dragX.current = 0;
      dragY.current = 0;
      gesture.current = "none";
    }
  };

  const fetchMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/media`, {
        headers: { Authorization: `Bearer ${token?.trim()}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("family_token");
        setToken(null);
        return;
      }
      if (!res.ok) throw new Error("Network error");
      const data: MediaRecord[] = await res.json();
      const enhanced: EnhancedMediaRecord[] = (data || []).map((item) => ({
        ...item,
        dateGroup: formatDateGroup(item.createdAt),
      }));
      setMedia(enhanced);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMedia(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) fetchMedia();
  }, [token, fetchMedia]);

  const parseBackendError = async (
    xhr: XMLHttpRequest,
  ): Promise<{
    status: UploadQueueItem["status"];
    error?: string;
    duplicate?: string;
  }> => {
    const text = xhr.responseText;

    if (xhr.status === 409) {
      try {
        const json = JSON.parse(text);
        return { status: "duplicate", duplicate: json.existing ?? "unknown" };
      } catch {
        return { status: "duplicate" };
      }
    }

    if (xhr.status === 401) {
      localStorage.removeItem("family_token");
      setToken(null);
      return { status: "error", error: "Session expired" };
    }

    if (xhr.status === 400) {
      const msg = text.trim() || "Invalid file";
      const friendly: Record<string, string> = {
        "Not allowed media format": "Format not supported",
        "File size exceeds limit or invalid form": "File too large (max 10 GB)",
        "Error reading file": "Could not read file",
        "Error processing file": "Could not process file",
      };
      return { status: "error", error: friendly[msg] ?? msg };
    }

    if (xhr.status >= 500) {
      return { status: "error", error: "Server error — try again" };
    }

    if (xhr.status === 0) {
      return { status: "error", error: "No connection" };
    }

    return { status: "error", error: `Unexpected error (${xhr.status})` };
  };

  const uploadFile = (item: UploadQueueItem) => {
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("media", item.file);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setQueue((q) =>
          q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)),
        );
      };

      xhr.onload = async () => {
        if (xhr.status === 201) {
          setQueue((q) => {
            const updated = q.map((x) =>
              x.id === item.id
                ? { ...x, status: "done" as const, progress: 100 }
                : x,
            );
            const stillActive = updated.filter(
              (x) => x.status === "pending" || x.status === "uploading",
            );
            if (stillActive.length === 0) setTimeout(fetchMedia, 800);
            return updated;
          });
        } else {
          const result = await parseBackendError(xhr);
          setQueue((q) =>
            q.map((x) => (x.id === item.id ? { ...x, ...result } : x)),
          );
        }
        resolve();
      };

      xhr.onerror = () => {
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? { ...x, status: "error", error: "No connection" }
              : x,
          ),
        );
        resolve();
      };

      xhr.ontimeout = () => {
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? { ...x, status: "error", error: "Request timed out" }
              : x,
          ),
        );
        resolve();
      };

      xhr.open("POST", `${API_BASE_URL}/api/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token?.trim()}`);
      xhr.timeout = 60 * 60 * 1000;
      setQueue((q) =>
        q.map((x) => (x.id === item.id ? { ...x, status: "uploading" } : x)),
      );
      xhr.send(formData);
    });
  };

  const processQueue = async (items: UploadQueueItem[]) => {
    for (const item of items) {
      await uploadFile(item);
    }
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "RETRY_UPLOADS") {
        setQueue((q) => {
          const toRetry = q.filter((x) => x.status === "error");
          if (toRetry.length > 0) processQueue(toRetry);
          return q.map((x) =>
            x.status === "error"
              ? {
                  ...x,
                  status: "pending" as const,
                  progress: 0,
                  error: undefined,
                }
              : x,
          );
        });
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "pending",
      progress: 0,
    }));
    setQueue((q) => {
      const combined = [...q, ...newItems];
      processQueue(newItems);
      return combined;
    });
  };

  const retryItem = (id: string) => {
    setQueue((q) => {
      const item = q.find((x) => x.id === id);
      if (!item || item.status === "duplicate") return q;
      const reset = {
        ...item,
        status: "pending" as const,
        progress: 0,
        error: undefined,
        duplicate: undefined,
      };
      const updated = q.map((x) => (x.id === id ? reset : x));
      processQueue([reset]);
      return updated;
    });
  };

  const dismissDone = () => {
    setQueue((q) =>
      q.filter((x) => x.status !== "done" && x.status !== "duplicate"),
    );
  };

  const scrollToDate = (date: string) => {
    const target = dateRefs.current[date];
    if (target) {
      const offset = 190;
      const elementPosition = target.getBoundingClientRect().top;
      window.scrollTo({
        top: elementPosition + window.pageYOffset - offset,
        behavior: "smooth",
      });
    }
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenInput.trim()) {
              localStorage.setItem("family_token", tokenInput.trim());
              setToken(tokenInput.trim());
            }
          }}
          className="w-full max-w-sm bg-[#242424] border border-[#303030] p-6 rounded-3xl shadow-2xl space-y-4"
        >
          <h1 className="text-xl font-bold text-white text-center tracking-tight">
            Family Cloud
          </h1>
          <input
            type="password"
            placeholder="Access token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full px-4 py-3 bg-[#1e1e1e] border border-[#383838] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 font-semibold text-sm rounded-xl text-white"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="bg-[#1e1e1e] text-[#e0e0e0] flex flex-col font-sans antialiased selection:bg-indigo-500/40"
      style={{ minHeight: "100dvh" }}
    >
      {!isOnline && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-1.5 bg-amber-500/95 backdrop-blur-md text-[11px] font-bold text-black animate-fade-in"
          style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728"
            />
          </svg>
          No connection — browsing cached content
        </div>
      )}

      <input
        type="file"
        multiple
        accept="image/*,video/*"
        ref={uploadInputRef}
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      <header
        className="bg-[#242424]/60 backdrop-blur-2xl border-b border-[#303030]/40 sticky top-0 z-40 px-4 flex justify-between items-center"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
        }}
      >
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            Library
          </h1>
          <p className="text-[10px] font-semibold text-zinc-500">
            {media.length > 0
              ? `${media.filter((m) => m.type === "photo").length} photos · ${media.filter((m) => m.type === "video").length} videos`
              : "Family Server"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMedia()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2d2d2d] hover:bg-[#383838] border border-[#404040]/60 rounded-xl text-emerald-400 shadow-md transition-all active:scale-90"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-[11px] font-bold">Refresh</span>
          </button>

          <button
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2d2d2d] hover:bg-[#383838] border border-[#404040]/60 rounded-xl text-indigo-400 shadow-md transition-all active:scale-90"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-[11px] font-bold">Upload</span>
          </button>
        </div>
      </header>

      <div
        className="sticky bg-[#1e1e1e]/60 backdrop-blur-2xl pt-3 pb-3.5 z-30 border-b border-[#303030]/30 flex flex-col gap-3"
        style={{ top: "calc(53px + env(safe-area-inset-top))" }}
      >
        <div className="px-4">
          <div className="bg-[#242424]/80 p-0.5 rounded-2xl flex border border-[#303030]/60 shadow-inner">
            {(["all", "photo", "video"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilter(t);
                  setVisibleCount(120);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  filter === t
                    ? "bg-[#383838] text-white shadow border border-[#484848]/40"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "all" && "All"}
                {t === "photo" && "Photos"}
                {t === "video" && "Videos"}
              </button>
            ))}
          </div>
        </div>

        {allUniqueDates.length > 0 && (
          <div className="w-full flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none snap-x">
            {allUniqueDates.map((date) => (
              <button
                key={date}
                onClick={() => scrollToDate(date)}
                className="shrink-0 snap-center px-4 py-1.5 bg-[#242424]/60 hover:bg-[#303030] border border-[#383838]/40 rounded-full text-[11px] font-bold tracking-wide text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                {date}
              </button>
            ))}
          </div>
        )}
      </div>

      <main
        className="flex-1 flex flex-col max-w-4xl w-full mx-auto pb-32"
        style={{ overscrollBehavior: "none" }}
      >
        {loadingMedia ? (
          <div className="p-16 text-center text-zinc-600 text-xs font-semibold tracking-wider animate-pulse">
            Loading media...
          </div>
        ) : totalFiltered === 0 ? (
          <div className="p-16 text-center text-zinc-600 text-xs border border-dashed border-[#303030] m-4 rounded-3xl">
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
                  className="sticky bg-[#1e1e1e]/60 backdrop-blur-2xl py-2 z-10 flex justify-between items-center border-b border-[#303030]/20"
                  style={{ top: "calc(154px + env(safe-area-inset-top))" }}
                >
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    {date}
                  </h2>
                  <span className="text-[10px] font-bold text-zinc-500 bg-[#242424] px-2 py-0.5 rounded-lg border border-[#303030]/40">
                    {groupedGroups[date].length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {groupedGroups[date].map((rec) => (
                    <LazyMediaCard
                      key={rec.filename}
                      rec={rec}
                      selected={selected.has(rec.filename)}
                      selectMode={selectMode}
                      onLongPress={() => toggleSelect(rec.filename)}
                      onClick={() => {
                        if (selectMode) toggleSelect(rec.filename);
                        else setActiveMedia(rec);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {totalFiltered > visibleCount && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 60)}
                className="mt-8 mx-auto px-6 py-2.5 bg-[#242424] hover:bg-[#2d2d2d] border border-[#303030] rounded-xl text-xs font-bold tracking-wide text-zinc-400 transition-colors active:scale-95"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </main>

      {selectMode && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2.5 bg-[#242424]/95 backdrop-blur-2xl border border-[#383838] rounded-2xl shadow-2xl animate-fade-in"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={clearSelect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {selected.size} selected
          </button>

          <div className="w-px h-5 bg-[#383838]" />

          <button
            onClick={selectAll}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-colors"
          >
            All
          </button>

          <div className="w-px h-5 bg-[#383838]" />

          <button
            onClick={downloadSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Save
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 w-[min(92vw,380px)] bg-[#242424]/95 backdrop-blur-2xl border border-[#383838] rounded-2xl shadow-2xl overflow-hidden"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#303030]">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {(() => {
                const done = queue.filter(
                  (x) => x.status === "done" || x.status === "duplicate",
                ).length;
                const total = queue.length;
                const active = queue.filter(
                  (x) => x.status === "uploading",
                ).length;
                if (active > 0) return `Uploading ${done}/${total}`;
                if (done === total)
                  return `${total} file${total > 1 ? "s" : ""} processed`;
                return `${done}/${total} done`;
              })()}
            </span>
            {queue.every((x) =>
              ["done", "duplicate", "error"].includes(x.status),
            ) && (
              <button
                onClick={dismissDone}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-[#303030]/60">
            {queue.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 flex items-center gap-3"
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.status === "done"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : item.status === "duplicate"
                        ? "bg-amber-500/20  text-amber-400"
                        : item.status === "error"
                          ? "bg-red-500/20    text-red-400"
                          : item.status === "uploading"
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-[#303030]      text-zinc-500"
                  }`}
                >
                  {item.status === "done"
                    ? "✓"
                    : item.status === "duplicate"
                      ? "="
                      : item.status === "error"
                        ? "✗"
                        : item.status === "uploading"
                          ? "↑"
                          : "·"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-300 truncate">
                    {item.file.name}
                  </p>

                  {item.status === "uploading" && (
                    <div className="mt-1 h-1 bg-[#303030] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === "done" && (
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      Uploaded
                    </p>
                  )}
                  {item.status === "duplicate" && (
                    <p className="text-[10px] text-amber-400 mt-0.5 truncate">
                      Already exists
                      {item.duplicate ? ` · ${item.duplicate}` : ""}
                    </p>
                  )}
                  {item.status === "error" && (
                    <p className="text-[10px] text-red-400 mt-0.5">
                      {item.error ?? "Unknown error"}
                    </p>
                  )}
                  {item.status === "pending" && (
                    <p className="text-[10px] text-zinc-600 mt-0.5">Waiting…</p>
                  )}
                </div>

                {item.status === "error" && (
                  <button
                    onClick={() => retryItem(item.id)}
                    className="shrink-0 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/10 rounded-lg transition-colors active:scale-95"
                  >
                    Retry
                  </button>
                )}

                {item.status === "uploading" && (
                  <span className="shrink-0 text-[10px] font-bold text-zinc-500 w-8 text-right">
                    {item.progress}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeMedia &&
        activeIndex !== -1 &&
        (() => {
          const prevItem = filteredList[activeIndex - 1] ?? null;
          const curItem = filteredList[activeIndex];
          const nextItem = filteredList[activeIndex + 1] ?? null;
          const slots = [prevItem, curItem, nextItem];

          return (
            <div
              ref={backdropRef}
              className="fixed inset-0 z-50 flex flex-col justify-between select-none overflow-hidden animate-fade-in"
              style={{
                backgroundColor: "rgba(0,0,0,0.98)",
                touchAction: "none",
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e)}
            >
              <div
                ref={topBarRef}
                className="p-4 bg-gradient-to-b from-black/90 via-black/30 to-transparent flex justify-between items-center z-20 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-zinc-400 font-semibold truncate max-w-[65%]">
                  {curItem.filename}
                </span>
                <button
                  onClick={() => setActiveMedia(null)}
                  className="text-zinc-400 hover:text-white p-2 bg-[#242424]/80 rounded-full backdrop-blur-md border border-[#383838]/80 shadow-xl active:scale-90 transition-transform"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex-1 relative w-full overflow-hidden">
                {slots.map((item, i) => {
                  const offset = (i - 1) * 100;
                  return (
                    <div
                      key={item?.filename ?? `empty-${i}`}
                      ref={(el) => {
                        slideRefs.current[i] = el;
                      }}
                      className="absolute inset-0 flex items-center justify-center p-3 will-change-transform"
                      style={{ transform: `translateX(${offset}%)` }}
                    >
                      {item &&
                        (item.type === "photo" ? (
                          <img
                            ref={i === 1 ? imgRef : undefined}
                            src={getMediaUrl(item)}
                            alt=""
                            draggable={false}
                            className="max-w-full max-h-[83vh] object-contain rounded-2xl shadow-2xl select-none"
                            style={{
                              willChange: "transform",
                              touchAction: "none",
                            }}
                          />
                        ) : (
                          <video
                            src={getMediaUrl(item)}
                            controls={i === 1}
                            autoPlay={i === 1}
                            muted
                            playsInline
                            className="max-w-full max-h-[83vh] rounded-2xl shadow-2xl"
                          />
                        ))}
                    </div>
                  );
                })}
              </div>

              {saveToast && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#242424]/90 backdrop-blur-md border border-[#383838] text-xs font-bold text-white shadow-xl animate-fade-in">
                  {saveToast === "saving" && "Saving…"}
                  {saveToast === "saved" && "✓ Saved to device"}
                  {saveToast === "error" && "✗ Save failed"}
                </div>
              )}

              <div
                ref={bottomBarRef}
                className="p-4 bg-gradient-to-t from-black/90 to-transparent text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest z-20"
              >
                {curItem.type} • {activeIndex + 1} of {filteredList.length}
                {curItem.type === "photo" && (
                  <span className="ml-2 opacity-40">
                    · hold to save · double tap to zoom
                  </span>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
