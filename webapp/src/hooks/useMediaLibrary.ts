import { useCallback, useEffect, useState } from "react";
import { fetchMediaList, UnauthorizedError } from "../route/request";
import { formatDateGroup } from "../utils/formatDateGroup";
import type { EnhancedMediaRecord } from "../shared/types/media.types";

export const useMediaLibrary = (
  token: string | null,
  onUnauthorized: () => void,
) => {
  const [media, setMedia] = useState<EnhancedMediaRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchMediaList(token);
      setMedia(
        data.map((item) => ({
          ...item,
          dateGroup: formatDateGroup(item.createdAt),
        })),
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized();
      else console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) refresh();
  }, [token, refresh]);

  return { media, loading, refresh };
};
