import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

function monorepoRoot(): string {
  return path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("invalid listen address"));
        return;
      }
      const port = addr.port;
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(
  cond: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs?: number }
): Promise<void> {
  const start = Date.now();
  const interval = opts.intervalMs ?? 200;
  while (Date.now() - start < opts.timeoutMs) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("condition not met within timeout");
}

function drain(prefix: string, stream: NodeJS.ReadableStream | null): void {
  if (!stream) return;
  stream.on("data", (chunk: string | Buffer) => {
    process.stderr.write(`[${prefix}] ${chunk.toString()}`);
  });
}

function startNodeService(
  label: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): ChildProcess {
  const proc = spawn(process.execPath, ["dist/main.js"], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  drain(`${label}-out`, proc.stdout);
  drain(`${label}-err`, proc.stderr);
  return proc;
}

async function stopProc(proc: ChildProcess | undefined): Promise<void> {
  if (!proc?.pid) return;
  proc.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 5000);
    proc.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

const e2e = process.env["SKIP_E2E"] === "1" ? describe.skip : describe;

e2e("enqueue flow with real postgres and redis", () => {
  const root = monorepoRoot();
  let apiPort: number;
  let apiProc: ChildProcess | undefined;
  let workerProc: ChildProcess | undefined;

  const databaseUrl =
    process.env["E2E_DATABASE_URL"] ??
    process.env["DATABASE_URL"] ??
    "postgresql://tqm:tqm@127.0.0.1:5432/tqm";
  const redisHost = process.env["REDIS_HOST"] ?? "127.0.0.1";
  const redisPort = process.env["REDIS_PORT"] ?? "6379";

  beforeAll(async () => {
    apiPort = await getFreePort();
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: databaseUrl,
      REDIS_HOST: redisHost,
      REDIS_PORT: redisPort,
      API_PORT: String(apiPort)
    };

    apiProc = startNodeService("api", path.join(root, "apps", "api"), childEnv);
    workerProc = startNodeService(
      "worker",
      path.join(root, "apps", "worker"),
      childEnv
    );

    const base = `http://127.0.0.1:${apiPort}`;
    await waitFor(
      async () => {
        try {
          const r = await fetch(`${base}/health`);
          return r.ok;
        } catch {
          return false;
        }
      },
      { timeoutMs: 60_000, intervalMs: 300 }
    );
  });

  afterAll(async () => {
    await stopProc(workerProc);
    await stopProc(apiProc);
  });

  it("POST /jobs is processed until job status is completed", async () => {
    const base = `http://127.0.0.1:${apiPort}`;
    const postRes = await fetch(`${base}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "e2e-task",
        payload: { delayMs: 80 }
      })
    });

    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { id: string; status: string };
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("queued");

    await waitFor(
      async () => {
        const r = await fetch(`${base}/jobs/${created.id}`);
        if (!r.ok) return false;
        const job = (await r.json()) as { status: string };
        return job.status === "completed";
      },
      { timeoutMs: 45_000, intervalMs: 250 }
    );
  });
});
