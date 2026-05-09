import type { Server } from "node:http";

import { loadConfig } from "./config.js";
import { createApiServer } from "./http/server.js";
import { JobsController } from "./jobs/jobs.controller.js";
import { JobsService } from "./jobs/jobs.service.js";
import { MetricsController } from "./metrics/metrics.controller.js";
import { MetricsService } from "./metrics/metrics.service.js";
import { disconnectPrisma, prisma } from "./prisma/prisma.module.js";
import { closeJobsQueue, jobsQueue } from "./queue/jobs-queue.js";

const jobsService = new JobsService(prisma, jobsQueue);
const jobsController = new JobsController(jobsService);
const metricsService = new MetricsService(prisma, jobsQueue);
const metricsController = new MetricsController(metricsService);

let httpServer: Server | undefined;

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  await prisma.$connect();
  console.log("[api] prisma connected", { port: config.apiPort });
  console.log("[api] bullmq queue ready", { name: jobsQueue.name });

  httpServer = createApiServer({ jobsController, metricsController });
  await new Promise<void>((resolve, reject) => {
    httpServer!.listen(config.apiPort, () => resolve());
    httpServer!.on("error", reject);
  });
  console.log("[api] listening", { port: config.apiPort });
}

function registerShutdownHooks(): void {
  const shutdown = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((err) => (err ? reject(err) : resolve()));
    });
    await closeJobsQueue();
    await disconnectPrisma();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

registerShutdownHooks();

bootstrap().catch(async (err: unknown) => {
  console.error(err);
  await closeJobsQueue().catch(() => {});
  await disconnectPrisma();
  process.exit(1);
});
