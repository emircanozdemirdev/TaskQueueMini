import { loadConfig } from "./config.js";

const bootstrap = (): void => {
  const config = loadConfig();
  console.log("[worker] scaffold ready", { redisHost: config.redisHost });
};

bootstrap();
