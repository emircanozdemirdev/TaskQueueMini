export interface WorkerConfig {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(): WorkerConfig {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    redisHost: process.env["REDIS_HOST"] ?? "localhost",
    redisPort: parseInt(process.env["REDIS_PORT"] ?? "6379", 10)
  };
}
