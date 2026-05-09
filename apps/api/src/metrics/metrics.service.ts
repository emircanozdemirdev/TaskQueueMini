import type { Queue } from "bullmq";
import { JobStatus, type PrismaClient } from "@prisma/client";

export interface MetricsSnapshot {
  jobsByStatus: Record<JobStatus, number>;
  redisQueueJobCounts: Record<string, number>;
}

export class MetricsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: Queue
  ) {}

  async getSnapshot(): Promise<MetricsSnapshot> {
    const grouped = await this.prisma.job.groupBy({
      by: ["status"],
      _count: { _all: true }
    });

    const jobsByStatus: Record<JobStatus, number> = {
      [JobStatus.queued]: 0,
      [JobStatus.processing]: 0,
      [JobStatus.completed]: 0,
      [JobStatus.failed]: 0
    };

    for (const row of grouped) {
      jobsByStatus[row.status] = row._count._all;
    }

    const redisQueueJobCounts = await this.queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    return { jobsByStatus, redisQueueJobCounts };
  }
}
