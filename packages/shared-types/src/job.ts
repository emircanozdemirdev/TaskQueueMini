export const JOB_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed"
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export interface CreateJobRequest {
  taskName: string;
  payload: Record<string, unknown>;
}

export interface CreateJobResponse {
  id: string;
  status: JobStatus;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  taskName: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attemptsMade: number;
  createdAt: Date;
  updatedAt: Date;
}
