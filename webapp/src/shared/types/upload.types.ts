export type UploadStatus =
  | "pending"
  | "uploading"
  | "done"
  | "duplicate"
  | "error";

export interface UploadQueueItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  duplicate?: string;
}
