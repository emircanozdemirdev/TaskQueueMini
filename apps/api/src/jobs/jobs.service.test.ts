import { describe, expect, it, jest } from "@jest/globals";
import { JobStatus, type Job, type PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import { JobsService } from "./jobs.service.js";

function minimalJob(overrides: Partial<Job> & Pick<Job, "id" | "name" | "payload">): Job {
  return {
    attemptsMade: 0,
    errorMessage: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    status: JobStatus.queued,
    ...overrides
  };
}

describe("JobsService.enqueue", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  function makeMocks() {
    const queueAdd = jest.fn() as jest.Mock<any>;
    const jobDelete = jest.fn() as jest.Mock<any>;
    const jobCreate = jest.fn() as jest.Mock<any>;

    const prisma = {
      job: {
        create: jobCreate,
        delete: jobDelete
      }
    } as unknown as PrismaClient;

    const queue = {
      add: queueAdd
    } as unknown as Queue;

    return { prisma, queue, queueAdd, jobDelete, jobCreate };
  }

  it("creates a queued job, enqueues with retry/backoff options, and returns response", async () => {
    const { prisma, queue, queueAdd, jobDelete, jobCreate } = makeMocks();
    const jobRow = minimalJob({
      id: "job_1",
      name: "send-email",
      payload: { to: "a@b.c" },
      status: JobStatus.queued,
      attemptsMade: 0,
      createdAt
    });
    jobCreate.mockResolvedValue(jobRow);
    queueAdd.mockResolvedValue(undefined);

    const service = new JobsService(prisma, queue);
    const result = await service.enqueue({
      name: "send-email",
      payload: { to: "a@b.c" }
    });

    expect(jobCreate).toHaveBeenCalledWith({
      data: {
        name: "send-email",
        payload: { to: "a@b.c" },
        status: JobStatus.queued
      }
    });
    expect(queueAdd).toHaveBeenCalledWith(
      "send-email",
      { jobId: "job_1", payload: { to: "a@b.c" } },
      {
        jobId: "job_1",
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 }
      }
    );
    expect(jobDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "job_1",
      status: JobStatus.queued,
      createdAt: createdAt.toISOString()
    });
  });

  it("deletes the job and throws ENQUEUE_FAILED when queue.add fails", async () => {
    const { prisma, queue, queueAdd, jobDelete, jobCreate } = makeMocks();
    const jobRow = minimalJob({
      id: "job_2",
      name: "task",
      payload: {},
      status: JobStatus.queued,
      attemptsMade: 0,
      createdAt
    });
    jobCreate.mockResolvedValue(jobRow);
    queueAdd.mockRejectedValue(new Error("redis down"));
    jobDelete.mockResolvedValue(undefined);

    const service = new JobsService(prisma, queue);

    await expect(
      service.enqueue({
        name: "task",
        payload: {}
      })
    ).rejects.toMatchObject({
      name: "HttpError",
      statusCode: 503,
      code: "ENQUEUE_FAILED"
    });

    expect(jobDelete).toHaveBeenCalledWith({ where: { id: "job_2" } });
    expect(queueAdd).toHaveBeenCalled();
  });
});
