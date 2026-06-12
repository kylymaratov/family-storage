export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const getMediaUrl = (record: {
  filename: string;
  type: "photo" | "video";
}) => {
  const subPath = record.type === "photo" ? "photos" : "video";
  return `${API_BASE_URL}/content/${subPath}/${record.filename}`;
};
