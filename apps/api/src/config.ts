export interface ApiConfig {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  apiPort: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(): ApiConfig {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    redisHost: process.env["REDIS_HOST"] ?? "localhost",
    redisPort: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
    apiPort: parseInt(process.env["API_PORT"] ?? "3000", 10)
  };
}
