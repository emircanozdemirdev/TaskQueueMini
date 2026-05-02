# TaskQueueMini

A minimal task queue built with NestJS, BullMQ, Postgres, and Redis.

Jobs are persisted in Postgres and processed via a BullMQ worker with retry and exponential backoff support.

## Stack

- **API:** NestJS (Node.js + TypeScript)
- **Worker:** Standalone Node.js + BullMQ
- **Queue:** Redis 7 + BullMQ
- **Database:** Postgres 16 + Prisma
- **Monorepo:** pnpm workspaces

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) >= 22 (see `.nvmrc`)
- [pnpm](https://pnpm.io) >= 10
- [Docker](https://www.docker.com) + Docker Compose

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/TaskQueueMini.git
cd TaskQueueMini

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env if needed (defaults work with docker-compose as-is)

# 4. Start Postgres and Redis
docker compose up -d

# 5. Apply database migrations
pnpm prisma migrate deploy

# 6. Start the API and worker
pnpm dev:all
```

The API will be available at `http://localhost:3000`.

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:all` | Start API and worker in watch mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `docker compose up -d` | Start Postgres + Redis |
| `docker compose down` | Stop all containers |

## Architecture

```
POST /jobs  ──►  API (NestJS)  ──►  Postgres (queued)
                      │
                      └──►  Redis (BullMQ queue)
                                   │
                             Worker (BullMQ)
                                   │
                      ┌────────────┴────────────┐
                  processing               failed (after retries)
                      │
                  completed
```

State machine: `queued → processing → completed | failed`

## License

MIT
