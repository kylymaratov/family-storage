export interface MediaRecord {
  filename: string;
  hash: string;
  type: "photo" | "video";
  createdAt: number;
}
