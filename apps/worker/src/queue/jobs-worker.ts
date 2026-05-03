import { Worker } from "bullmq";
import { createConnection, JOBS_QUEUE } from "@task-queue-mini/queue";

const connection = createConnection();

export const jobsWorker = new Worker(
  JOBS_QUEUE,
  async (job) => {
    console.log("[worker] noop job received", { id: job.id, name: job.name });
  },
  { connection }
);

export async function closeJobsWorker(): Promise<void> {
  await jobsWorker.close();
  await connection.quit();
}
