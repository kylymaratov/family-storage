export type MediaType = "photo" | "video";

export interface MediaRecord {
  filename: string;
  hash: string;
  type: MediaType;
  createdAt: number;
}

export interface EnhancedMediaRecord extends MediaRecord {
  dateGroup: string;
}
