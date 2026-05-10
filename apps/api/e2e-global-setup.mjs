import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default async function globalSetup() {
  if (process.env["SKIP_E2E"] === "1") {
    return;
  }

  const databaseUrl =
    process.env["E2E_DATABASE_URL"] ??
    process.env["DATABASE_URL"] ??
    "postgresql://tqm:tqm@127.0.0.1:5432/tqm";

  execSync("pnpm exec prisma migrate deploy", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
}
