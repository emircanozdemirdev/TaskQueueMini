import { loadConfig } from "./config.js";

const bootstrap = (): void => {
  const config = loadConfig();
  console.log("[api] scaffold ready", { port: config.apiPort });
};

bootstrap();
