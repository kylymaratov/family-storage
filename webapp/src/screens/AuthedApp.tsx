import { useCallback, useEffect, useState } from "react";
import { useMediaLibrary } from "../hooks/useMediaLibrary";
import { useUploadQueue } from "../hooks/useUploadQueue";
import { GalleryScreen } from "./GalleryScreen";
import { UploadsScreen } from "./UploadsScreen";

interface AuthedAppProps {
  token: string;
  onLogout: () => void;
}

export const AuthedApp = ({ token, onLogout }: AuthedAppProps) => {
  const [view, setView] = useState<"gallery" | "uploads">("gallery");
  const { media, loading, refresh } = useMediaLibrary(token, onLogout);
  const { queue, addFiles, retryItem, dismissDone } = useUploadQueue(
    token,
    refresh,
    onLogout,
  );

  const openUploads = useCallback(() => {
    window.history.pushState({ uploads: true }, "");
    setView("uploads");
  }, []);

  const backToGallery = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    const onPop = () => setView("gallery");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const activeCount = queue.filter(
    (x) => x.status === "pending" || x.status === "uploading",
  ).length;

  if (view === "uploads") {
    return (
      <UploadsScreen
        queue={queue}
        onAddFiles={addFiles}
        onRetry={retryItem}
        onDismiss={dismissDone}
        onBack={backToGallery}
      />
    );
  }

  return (
    <GalleryScreen
      media={media}
      loading={loading}
      refresh={refresh}
      uploadCount={activeCount}
      onOpenUploads={openUploads}
    />
  );
};
