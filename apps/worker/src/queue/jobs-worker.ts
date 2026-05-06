import { Worker } from "bullmq";
import { JobStatus } from "@prisma/client";
import { createConnection, JOBS_QUEUE } from "@task-queue-mini/queue";
import { prisma } from "../prisma/prisma.module.js";

const connection = createConnection();

export const jobsWorker = new Worker(
  JOBS_QUEUE,
  async (job) => {
    const data = (job.data ?? {}) as Record<string, unknown>;
    const jobId = typeof data["jobId"] === "string" ? data["jobId"] : undefined;

    if (!jobId) {
      console.log("[worker] job received without jobId", {
        queueJobId: job.id,
        name: job.name
      });
      return;
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.processing, startedAt: new Date() }
    });

    console.log("[worker] marked job as processing", {
      jobId,
      queueJobId: job.id,
      name: job.name
    });
  },
  { connection }
);

export async function closeJobsWorker(): Promise<void> {
  await jobsWorker.close();
  await connection.quit();
}
