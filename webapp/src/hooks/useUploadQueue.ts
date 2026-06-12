import { useCallback, useEffect, useRef, useState } from "react";
import { uploadMedia } from "../route/request";
import type { UploadQueueItem } from "../shared/types/upload.types";

const MAX_CONCURRENT = 3;

const createItems = (files: FileList): UploadQueueItem[] =>
  Array.from(files).map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    status: "pending",
    progress: 0,
  }));

export const useUploadQueue = (
  token: string | null,
  onUploaded: () => void,
  onUnauthorized: () => void,
) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const pendingRef = useRef<UploadQueueItem[]>([]);
  const activeRef = useRef(0);

  const runItem = useCallback(
    async (item: UploadQueueItem) => {
      const currentToken = tokenRef.current;
      if (!currentToken) return;

      setQueue((q) =>
        q.map((x) => (x.id === item.id ? { ...x, status: "uploading" } : x)),
      );

      const result = await uploadMedia(item.file, currentToken, (pct) =>
        setQueue((q) => {
          const cur = q.find((x) => x.id === item.id);
          if (!cur || cur.progress === pct) return q;
          return q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x));
        }),
      );

      if (result.unauthorized) onUnauthorized();

      setQueue((q) => {
        const updated = q.map((x) =>
          x.id === item.id
            ? result.status === "done"
              ? { ...x, status: "done" as const, progress: 100 }
              : {
                  ...x,
                  status: result.status,
                  error: result.error,
                  duplicate: result.duplicate,
                }
            : x,
        );
        const stillActive = updated.filter(
          (x) => x.status === "pending" || x.status === "uploading",
        );
        if (result.status === "done" && stillActive.length === 0)
          setTimeout(onUploaded, 800);
        return updated;
      });
    },
    [onUploaded, onUnauthorized],
  );

  const runItemRef = useRef(runItem);
  useEffect(() => {
    runItemRef.current = runItem;
  }, [runItem]);

  const pumpRef = useRef<() => void>(() => {
    while (activeRef.current < MAX_CONCURRENT && pendingRef.current.length > 0) {
      const next = pendingRef.current.shift()!;
      activeRef.current++;
      runItemRef.current(next).finally(() => {
        activeRef.current--;
        pumpRef.current();
      });
    }
  });

  const enqueue = useCallback((items: UploadQueueItem[]) => {
    pendingRef.current.push(...items);
    pumpRef.current();
  }, []);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newItems = createItems(files);
      setQueue((q) => [...q, ...newItems]);
      enqueue(newItems);
    },
    [enqueue],
  );

  const retryItem = useCallback(
    (id: string) => {
      setQueue((q) => {
        const item = q.find((x) => x.id === id);
        if (!item || item.status === "duplicate") return q;
        const reset: UploadQueueItem = {
          ...item,
          status: "pending",
          progress: 0,
          error: undefined,
          duplicate: undefined,
        };
        enqueue([reset]);
        return q.map((x) => (x.id === id ? reset : x));
      });
    },
    [enqueue],
  );

  const dismissDone = useCallback(() => {
    setQueue((q) =>
      q.filter((x) => x.status !== "done" && x.status !== "duplicate"),
    );
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "RETRY_UPLOADS") return;
      setQueue((q) => {
        const toRetry = q
          .filter((x) => x.status === "error")
          .map((x) => ({
            ...x,
            status: "pending" as const,
            progress: 0,
            error: undefined,
          }));
        if (toRetry.length > 0) enqueue(toRetry);
        return q.map((x) =>
          x.status === "error"
            ? { ...x, status: "pending" as const, progress: 0, error: undefined }
            : x,
        );
      });
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [enqueue]);

  return { queue, addFiles, retryItem, dismissDone };
};
