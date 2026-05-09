import type { Queue } from "bullmq";
import { JobStatus, type Prisma, type PrismaClient } from "@prisma/client";
import type { CreateJobResponse, JobListPage, JobRecord } from "@task-queue-mini/shared-types";

import { HttpError } from "../http/errors.js";
import type { CreateJobDto } from "./dto/create-job.dto.js";

const CURSOR_SEP = "\u0000";

function encodeFailedJobsCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}${CURSOR_SEP}${id}`, "utf8").toString(
    "base64url"
  );
}

function decodeFailedJobsCursor(cursor: string): { createdAt: Date; id: string } {
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new Error("invalid_cursor");
  }
  const idx = raw.indexOf(CURSOR_SEP);
  if (idx === -1) {
    throw new Error("invalid_cursor");
  }
  const createdAt = new Date(raw.slice(0, idx));
  const id = raw.slice(idx + CURSOR_SEP.length);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    throw new Error("invalid_cursor");
  }
  return { createdAt, id };
}

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

    return this.toJobRecord(job);
  }

  async listFailed(options: { cursor?: string; limit: number }): Promise<JobListPage> {
    const { limit } = options;
    const cursor =
      options.cursor !== undefined && options.cursor.length > 0
        ? options.cursor
        : undefined;

    let cursorPayload: { createdAt: Date; id: string } | undefined;
    if (cursor !== undefined) {
      try {
        cursorPayload = decodeFailedJobsCursor(cursor);
      } catch {
        throw new HttpError("Invalid cursor", 400, "INVALID_CURSOR");
      }
    }

    const where: Prisma.JobWhereInput = {
      status: JobStatus.failed,
      ...(cursorPayload !== undefined
        ? {
            OR: [
              { createdAt: { lt: cursorPayload.createdAt } },
              {
                AND: [
                  { createdAt: cursorPayload.createdAt },
                  { id: { lt: cursorPayload.id } }
                ]
              }
            ]
          }
        : {})
    };

    const rows = await this.prisma.job.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const items = pageRows.map((row) => this.toJobRecord(row));

    let nextCursor: string | null = null;
    if (hasNext && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1]!;
      nextCursor = encodeFailedJobsCursor(last.createdAt, last.id);
    }

    return { items, nextCursor };
  }

  private toJobRecord(job: {
    id: string;
    name: string;
    payload: unknown;
    status: JobStatus;
    attemptsMade: number;
    createdAt: Date;
    completedAt: Date | null;
    startedAt: Date | null;
    errorMessage: string | null;
  }): JobRecord {
    return {
      id: job.id,
      taskName: job.name,
      payload: job.payload as Record<string, unknown>,
      status: job.status,
      attemptsMade: job.attemptsMade,
      createdAt: job.createdAt,
      updatedAt: job.completedAt ?? job.startedAt ?? job.createdAt,
      errorMessage: job.errorMessage
    };
  }
}
