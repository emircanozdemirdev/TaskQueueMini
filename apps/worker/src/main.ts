import { loadConfig } from "./config.js";
import { disconnectPrisma, prisma } from "./prisma/prisma.module.js";
import { closeJobsWorker, jobsWorker } from "./queue/jobs-worker.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  await prisma.$connect();
  console.log("[worker] prisma connected", { redisHost: config.redisHost });
  await jobsWorker.waitUntilReady();
  console.log("[worker] bullmq worker ready", { name: jobsWorker.name });
}

function registerShutdownHooks(): void {
  const shutdown = async (): Promise<void> => {
    await closeJobsWorker();
    await disconnectPrisma();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

registerShutdownHooks();

bootstrap().catch(async (err: unknown) => {
  console.error(err);
  await closeJobsWorker().catch(() => {});
  await disconnectPrisma();
  process.exit(1);
});
