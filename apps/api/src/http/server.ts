import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";

import type { JobsController } from "../jobs/jobs.controller.js";
import { HttpError } from "./errors.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload, "utf8")
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export interface CreateApiServerOptions {
  jobsController: JobsController;
}

export function createApiServer(options: CreateApiServerOptions): Server {
  const { jobsController } = options;

  return createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      const method = req.method ?? "GET";

      if (method === "GET" && url === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && url.startsWith("/jobs/")) {
        const requestUrl = new URL(url, "http://127.0.0.1");

        if (requestUrl.pathname === "/jobs/failed") {
          try {
            const result = await jobsController.listFailed({
              cursor: requestUrl.searchParams.get("cursor") ?? undefined,
              limit: requestUrl.searchParams.get("limit") ?? undefined
            });
            sendJson(res, 200, result);
          } catch (err) {
            if (err instanceof HttpError) {
              sendJson(res, err.statusCode, {
                error: { code: err.code, message: err.message }
              });
              return;
            }
            console.error(err);
            sendJson(res, 500, {
              error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred"
              }
            });
          }
          return;
        }

        const id = decodeURIComponent(requestUrl.pathname.slice("/jobs/".length));
        if (!id) {
          sendJson(res, 400, {
            error: { code: "VALIDATION_ERROR", message: "Job id is required" }
          });
          return;
        }

        try {
          const result = await jobsController.getById(id);
          sendJson(res, 200, result);
        } catch (err) {
          if (err instanceof HttpError) {
            sendJson(res, err.statusCode, {
              error: { code: err.code, message: err.message }
            });
            return;
          }
          console.error(err);
          sendJson(res, 500, {
            error: {
              code: "INTERNAL_ERROR",
              message: "An unexpected error occurred"
            }
          });
        }
        return;
      }

      if (method === "POST" && url === "/jobs") {
        const raw = await readBody(req);
        let body: unknown;
        try {
          body = raw.length > 0 ? JSON.parse(raw) : {};
        } catch {
          sendJson(res, 400, {
            error: {
              code: "INVALID_JSON",
              message: "Request body must be valid JSON"
            }
          });
          return;
        }

        try {
          const result = await jobsController.create(body);
          sendJson(res, 201, result);
        } catch (err) {
          if (err instanceof HttpError) {
            sendJson(res, err.statusCode, {
              error: { code: err.code, message: err.message }
            });
            return;
          }
          console.error(err);
          sendJson(res, 500, {
            error: {
              code: "INTERNAL_ERROR",
              message: "An unexpected error occurred"
            }
          });
        }
        return;
      }

      sendJson(res, 404, {
        error: { code: "NOT_FOUND", message: "Not found" }
      });
    } catch (err) {
      console.error(err);
      sendJson(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      });
    }
  });
}
