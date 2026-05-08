import type { Queue } from "bullmq";
import { JobStatus, type Prisma, type PrismaClient } from "@prisma/client";
import type { CreateJobResponse, JobRecord } from "@task-queue-mini/shared-types";

import { HttpError } from "../http/errors.js";
import type { CreateJobDto } from "./dto/create-job.dto.js";

export class JobsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: Queue
  ) {}

  async enqueue(dto: CreateJobDto): Promise<CreateJobResponse> {
    const job = await this.prisma.job.create({
      data: {
        name: dto.name,
        payload: dto.payload as Prisma.InputJsonValue,
        status: JobStatus.queued
      }
    });

    try {
      await this.queue.add(
        dto.name,
        { jobId: job.id, payload: dto.payload },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 }
        }
      );
    } catch {
      await this.prisma.job.delete({ where: { id: job.id } });
      throw new HttpError("Failed to enqueue job", 503, "ENQUEUE_FAILED");
    }

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString()
    };
  }

  async getById(id: string): Promise<JobRecord> {
    const job = await this.prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new HttpError("Job not found", 404, "JOB_NOT_FOUND");
    }

    return {
      id: job.id,
      taskName: job.name,
      payload: job.payload as Record<string, unknown>,
      status: job.status,
      attemptsMade: job.attemptsMade,
      createdAt: job.createdAt,
      updatedAt: job.completedAt ?? job.startedAt ?? job.createdAt
    };
  }
}
