import { Worker } from "bullmq";
import { JobStatus } from "@prisma/client";
import { createConnection, JOBS_QUEUE } from "@task-queue-mini/queue";
import { prisma } from "../prisma/prisma.module.js";

const connection = createConnection();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

    const payload = (data["payload"] ?? {}) as Record<string, unknown>;
    const rawDelay = payload["delayMs"];
    const delayMs =
      typeof rawDelay === "number" && Number.isFinite(rawDelay)
        ? Math.max(0, Math.floor(rawDelay))
        : 100;

    await delay(delayMs);

    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.completed, completedAt: new Date() }
    });

    console.log("[worker] job completed", { jobId, delayMs });
  },
  { connection }
);

export async function closeJobsWorker(): Promise<void> {
  await jobsWorker.close();
  await connection.quit();
}
