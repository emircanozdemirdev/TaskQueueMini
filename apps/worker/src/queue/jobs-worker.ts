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

function getJobId(data: unknown): string | undefined {
  const payload = (data ?? {}) as Record<string, unknown>;
  return typeof payload["jobId"] === "string" ? payload["jobId"] : undefined;
}

export const jobsWorker = new Worker(
  JOBS_QUEUE,
  async (job) => {
    const data = (job.data ?? {}) as Record<string, unknown>;
    const jobId = getJobId(data);

    if (!jobId) {
      console.log("[worker] job received without jobId", {
        queueJobId: job.id,
        name: job.name
      });
      return;
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true }
    });

    if (!existingJob) {
      console.log("[worker] jobId not found in database", {
        jobId,
        queueJobId: job.id
      });
      return;
    }

    if (
      existingJob.status === JobStatus.completed ||
      existingJob.status === JobStatus.failed
    ) {
      console.log("[worker] skip already terminal job", {
        jobId,
        status: existingJob.status
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
      name: job.name,
      attemptsMade: job.attemptsMade
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

jobsWorker.on("failed", async (job, err) => {
  if (!job) return;

  const jobId = getJobId(job.data);
  if (!jobId) return;

  const maxAttempts =
    typeof job.opts.attempts === "number" && Number.isFinite(job.opts.attempts)
      ? job.opts.attempts
      : 1;
  const isFinalAttempt = job.attemptsMade >= maxAttempts;

  if (!isFinalAttempt) return;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.failed,
      errorMessage: err.message,
      attemptsMade: job.attemptsMade
    }
  });

  console.log("[worker] marked job as failed", {
    jobId,
    attemptsMade: job.attemptsMade,
    reason: err.message
  });
});

export async function closeJobsWorker(): Promise<void> {
  await jobsWorker.close();
  await connection.quit();
}
