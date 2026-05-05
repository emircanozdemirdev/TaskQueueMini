import type { Queue } from "bullmq";
import { JobStatus, type Prisma, type PrismaClient } from "@prisma/client";
import type { CreateJobResponse } from "@task-queue-mini/shared-types";

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
        { jobId: job.id }
      );
    } catch {
      await this.prisma.job.delete({ where: { id: job.id } });
      throw new Error("Failed to enqueue job");
    }

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString()
    };
  }
}
