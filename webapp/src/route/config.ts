import type { MediaRecord } from "../shared/types/media.types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const ENDPOINTS = {
  media: `${API_BASE_URL}/cloud/media`,
  uploadInit: `${API_BASE_URL}/cloud/upload/init`,
  uploadSession: (id: string) => `${API_BASE_URL}/cloud/upload/${id}`,
};

export const getMediaUrl = (record: Pick<MediaRecord, "filename" | "type">) => {
  const subPath = record.type === "photo" ? "photos" : "video";
  return `${API_BASE_URL}/cloud/${subPath}/${record.filename}`;
};
