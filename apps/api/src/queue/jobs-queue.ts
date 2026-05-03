import { Queue } from "bullmq";
import { createConnection, JOBS_QUEUE } from "@task-queue-mini/queue";

const connection = createConnection();

export const jobsQueue = new Queue(JOBS_QUEUE, { connection });

export async function closeJobsQueue(): Promise<void> {
  await jobsQueue.close();
  await connection.quit();
}
