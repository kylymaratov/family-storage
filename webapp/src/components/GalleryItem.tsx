import React, { useCallback, useRef } from "react";
import { getMediaUrl } from "../route/config";
import { CheckIcon, PlayIcon } from "./icons";
import type { EnhancedMediaRecord } from "../shared/types/media.types";

interface GalleryItemProps {
  rec: EnhancedMediaRecord;
  selected: boolean;
  selectMode: boolean;
  onOpen: (rec: EnhancedMediaRecord) => void;
  onToggle: (filename: string) => void;
}

const GalleryItemBase = ({
  rec,
  selected,
  selectMode,
  onOpen,
  onToggle,
}: GalleryItemProps) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      onToggle(rec.filename);
    }, 500);
  }, [onToggle, rec.filename]);

  const handlePressEnd = useCallback(() => {
    if (!pressTimer.current) return;
    clearTimeout(pressTimer.current);
    pressTimer.current = null;
    if (selectMode) onToggle(rec.filename);
    else onOpen(rec);
  }, [onToggle, onOpen, rec, selectMode]);

  const handlePressCancel = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  return (
    <div
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressCancel}
      onPointerCancel={handlePressCancel}
      className={`cv-auto aspect-square bg-surface rounded-[var(--radius-card)] overflow-hidden relative cursor-pointer border ${
        selected ? "border-accent" : "border-white/8"
      }`}
    >
      {rec.type === "photo" ? (
        <img
          src={getMediaUrl(rec)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-bg">
          <div className="p-3 bg-surface-2 rounded-full border border-white/10 text-accent">
            <PlayIcon className="w-5 h-5" />
          </div>
        </div>
      )}

      {rec.type === "video" && (
        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded-md text-[9px] text-content font-bold uppercase tracking-wider border border-white/10">
          Video
        </div>
      )}

      {selectMode && (
        <div
          className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? "bg-accent border-accent" : "bg-black/30 border-white/60"
          }`}
        >
          {selected && <CheckIcon className="w-3 h-3 text-white" />}
        </div>
      )}
    </div>
  );
};

export const GalleryItem = React.memo(GalleryItemBase);
GalleryItem.displayName = "GalleryItem";
