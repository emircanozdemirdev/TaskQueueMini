import { loadConfig } from "./config.js";
import { disconnectPrisma, prisma } from "./prisma/prisma.module.js";
import { closeJobsQueue, jobsQueue } from "./queue/jobs-queue.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  await prisma.$connect();
  console.log("[api] prisma connected", { port: config.apiPort });
  console.log("[api] bullmq queue ready", { name: jobsQueue.name });
}

function registerShutdownHooks(): void {
  const shutdown = async (): Promise<void> => {
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
