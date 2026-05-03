import { loadConfig } from "./config.js";
import { disconnectPrisma, prisma } from "./prisma/prisma.module.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  await prisma.$connect();
  console.log("[api] prisma connected", { port: config.apiPort });
}

function registerShutdownHooks(): void {
  const shutdown = async (): Promise<void> => {
    await disconnectPrisma();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

registerShutdownHooks();

bootstrap().catch(async (err: unknown) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
