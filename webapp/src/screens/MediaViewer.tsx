import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMediaUrl } from "../route/config";
import { CloseIcon } from "../components/icons";
import type { EnhancedMediaRecord } from "../shared/types/media.types";

interface MediaViewerProps {
  items: EnhancedMediaRecord[];
  activeMedia: EnhancedMediaRecord | null;
  onChange: (media: EnhancedMediaRecord | null) => void;
}

export const MediaViewer = ({
  items,
  activeMedia,
  onChange,
}: MediaViewerProps) => {
  const [saveToast, setSaveToast] = useState<
    "saving" | "saved" | "error" | null
  >(null);

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

  const slideRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);

  const activeIndex = useMemo(() => {
    if (!activeMedia) return -1;
    return items.findIndex((m) => m.filename === activeMedia.filename);
  }, [activeMedia, items]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) onChange(items[activeIndex - 1]);
  }, [activeIndex, items, onChange]);

  const handleNext = useCallback(() => {
    if (activeIndex < items.length - 1) onChange(items[activeIndex + 1]);
  }, [activeIndex, items, onChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeIndex === -1) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onChange(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, handlePrev, handleNext, onChange]);

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
        cur.style.opacity = "0";
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
          const s = slideRefs.current[1];
          if (s) {
            s.style.transition = "opacity 0.15s ease";
            s.style.opacity = "1";
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
    img.style.transition = animated
      ? "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      : "none";
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
      const res = await fetch(getMediaUrl(item));
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

    const item = items[activeIndex];
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
      const atEnd = activeIndex === items.length - 1;
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
          applyZoom(2.5, zoomOrigin.current.x, zoomOrigin.current.y, 0, 0, true);
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
      if (dx < -SWIPE_X && activeIndex < items.length - 1) {
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
        slideOut(dy < 0 ? "up" : "down", () => onChange(null));
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

  if (!activeMedia || activeIndex === -1) return null;

  const prevItem = items[activeIndex - 1] ?? null;
  const curItem = items[activeIndex];
  const nextItem = items[activeIndex + 1] ?? null;
  const slots = [prevItem, curItem, nextItem];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex flex-col justify-between select-none overflow-hidden animate-fade-in"
      style={{ backgroundColor: "rgba(0,0,0,0.98)", touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={topBarRef}
        className="p-4 bg-gradient-to-b from-black/90 via-black/30 to-transparent flex justify-between items-center z-20 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-muted font-semibold truncate max-w-[65%]">
          {curItem.filename}
        </span>
        <button
          onClick={() => onChange(null)}
          className="text-muted hover:text-content p-2 bg-surface rounded-full border border-white/10 shadow-xl active:scale-90 transition-transform"
        >
          <CloseIcon className="w-4 h-4" />
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
                    decoding="async"
                    fetchPriority={i === 1 ? "high" : "low"}
                    className="max-w-full max-h-[83vh] object-contain rounded-[var(--radius-card)] shadow-2xl select-none"
                    style={{ willChange: "transform", touchAction: "none" }}
                  />
                ) : (
                  <video
                    src={getMediaUrl(item)}
                    controls={i === 1}
                    autoPlay={i === 1}
                    muted
                    playsInline
                    className="max-w-full max-h-[83vh] rounded-[var(--radius-card)] shadow-2xl"
                  />
                ))}
            </div>
          );
        })}
      </div>

      {saveToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-[var(--radius-control)] bg-surface border border-white/12 text-xs font-bold text-content shadow-xl">
          {saveToast === "saving" && "Saving…"}
          {saveToast === "saved" && "✓ Saved to device"}
          {saveToast === "error" && "✗ Save failed"}
        </div>
      )}

      <div
        ref={bottomBarRef}
        className="p-4 bg-gradient-to-t from-black/90 to-transparent text-center text-[10px] font-bold text-faint uppercase tracking-widest z-20"
      >
        {curItem.type} • {activeIndex + 1} of {items.length}
        {curItem.type === "photo" && (
          <span className="ml-2 opacity-40">
            · hold to save · double tap to zoom
          </span>
        )}
      </div>
    </div>
  );
};
