# Echoes API

Backend API for Echoes, a music life timeline platform that turns listening history into a
personal journal. Users can save songs with dates, notes, tags, and links, then revisit patterns
through timeline and statistics views.

> Concept: "บันทึกช่วงเวลาของชีวิตผ่านเสียงเพลง" - record moments of life through music.

## Features

- Email/password authentication with email verification and password reset flows
- Google and LINE OAuth sign-in
- JWT access tokens with refresh-token cookies and rotation
- User track timeline CRUD with cursor pagination, tag filtering, and ownership checks
- Track deduplication by normalized title and artist
- Personal tag management with optional colors
- Full-text user-track search plus artist, tag, and date filters
- Stats endpoints for top artists, monthly activity, tag distribution, and dashboard overview
- Apple Music/iTunes track lookup and YouTube Music URL metadata extraction
- Web push token registration, test notifications, and "On This Day" reminders through Firebase
- Generated OpenAPI documentation served by Scalar

## Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js 25, TypeScript, ESM |
| Framework | Fastify |
| Validation | TypeBox |
| Database | PostgreSQL |
| ORM and migrations | Drizzle ORM, Drizzle Kit |
| Auth | OAuth2, fast-jwt, HTTP-only refresh-token cookies |
| Background jobs | pg-boss |
| Push notifications | Firebase Admin |
| Email | Resend |
| Testing | Node.js test runner, MSW, Testcontainers |
| Formatting and linting | Biome |

## Requirements

- Node.js 25+
- npm
- PostgreSQL, or Docker for the included compose service
- Docker if you plan to run the end-to-end test suite

## Quick Start

Install dependencies:

```bash
npm install
```

Create a local `.env` file:

```env
PORT=3000
HOST=0.0.0.0
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres
LOG_LEVEL=info

FRONTEND_URL=http://localhost:3001
ENABLE_COOKIE_SECURE=false

GOOGLE_CLIENT_ID=local-google-client-id
GOOGLE_CLIENT_SECRET=local-google-client-secret
GOOGLE_CALLBACK_URI=http://localhost:3000/api/v1/auth/google/callback

LINE_CLIENT_ID=local-line-client-id
LINE_CLIENT_SECRET=local-line-client-secret
LINE_CALLBACK_URI=http://localhost:3000/api/v1/auth/line/callback

JWT_ACCESS_TOKEN_SECRET=replace-with-at-least-32-characters
JWT_REFRESH_TOKEN_SECRET=replace-with-at-least-32-characters
JWT_ACCESS_TOKEN_TTL=15m
JWT_SLIDING_TTL_MS=2592000000
JWT_NBF_GRACE=10s

RESEND_API_KEY=local-resend-api-key

ENABLE_PG_BOSS=true
ON_THIS_DAY_CRON=0 9 * * *
ON_THIS_DAY_TIMEZONE=Asia/Bangkok

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Start PostgreSQL:

```bash
docker compose up -d
```

Apply the current schema to the local database:

```bash
npm run db:push
```

Start the development server:

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default.

Useful local URLs:

- `GET /api/health` - health check
- `/api/docs` - interactive API reference
- `/api/v1/*` - versioned API routes

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API with `.env` and file watching |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Build and run `dist/index.js` with `.env` |
| `npm run typecheck` | Type-check without emitting files |
| `npm run lint` | Run Biome checks |
| `npm run lint:fix` | Apply Biome fixes |
| `npm test` | Build, then run unit tests |
| `npm run test:unit` | Run `tests/**/*.test.ts` |
| `npm run test:e2e` | Build, then run `e2e/**/*.test.ts` serially |
| `npm run coverage` | Run tests with Node test coverage |
| `npm run db:migrate` | Generate Drizzle migration files |
| `npm run db:push` | Push the current Drizzle schema to the database |
| `npm run db:pull` | Pull database schema with Drizzle Kit |
| `npm run db:dev` | Open Drizzle Studio |
| `npm run generate:openapi` | Regenerate `openapi.yaml` |

## API Overview

All application routes are registered under `/api/v1`.

| Route group | Purpose |
| --- | --- |
| `/auth/register` | Create an email/password account and send verification mail |
| `/auth/login` | Issue an access token and refresh-token cookie |
| `/auth/refresh` | Rotate refresh token and issue a new access token |
| `/auth/logout` | Revoke the current refresh-token family |
| `/auth/me` | Fetch the authenticated user |
| `/auth/verify-email` | Verify an email verification token |
| `/auth/forgot-password` | Send password reset mail without email enumeration |
| `/auth/reset-password` | Reset password with a valid reset token |
| `/auth/google`, `/auth/line` | Start OAuth sign-in |
| `/user-tracks` | Create, list, update, and delete timeline entries |
| `/user-tracks/search` | Search and filter timeline entries |
| `/tags` | Manage user tags |
| `/tracks/search` | Search Apple Music/iTunes for track metadata |
| `/tracks/youtube` | Extract track metadata from a YouTube URL |
| `/stats/*` | Fetch dashboard and insight data |
| `/push/*` | Register tokens and send push notifications |

See `/api/docs` or `openapi.yaml` for request and response schemas.

## Project Structure

```text
src/
  app.ts                 Fastify app builder
  index.ts               Runtime entry point
  config/                Environment parsing and application config
  db/                    Drizzle schema, relations, and database client
  plugins/               Fastify plugins, services, repositories, shared schemas
  routes/                Autoloaded API routes and TypeBox schemas
  workers/               pg-boss worker definitions
tests/                   Unit and integration tests
e2e/                     Testcontainers-backed end-to-end tests
migrations/              Generated Drizzle migrations
scripts/                 Maintenance scripts, including OpenAPI generation
public/                  Static assets served by the API when present
```

## Database

The Drizzle schema is defined in `src/db/schema.ts`, with relation metadata in
`src/db/relations.ts`. Generated migrations are written to `migrations/`.

For local development, `npm run db:push` is the fastest way to sync the schema. For committed schema
changes, generate and review a migration:

```bash
npm run db:migrate
```

The app and Drizzle Kit both read the database connection from `POSTGRES_URL`.

## Testing

Run the default test suite:

```bash
npm test
```

Run only unit/integration tests:

```bash
npm run test:unit
```

Run end-to-end tests:

```bash
npm run test:e2e
```

The e2e suite uses Testcontainers and needs Docker. Tests use MSW for external HTTP mocking and
Fastify injection for route coverage.

## OpenAPI

The API reference is generated from Fastify route schemas and served at `/api/docs`.

Regenerate the checked-in OpenAPI file after changing public route contracts:

```bash
npm run generate:openapi
```

## Contributing Notes

- Use TypeBox for route request and response schemas.
- Keep route handlers focused on auth, validation, ownership checks, repository calls, and response
  shaping.
- Put database logic in repositories under `src/plugins/repositories/`.
- Use `request.getUser().sub` for authenticated user identity.
- Return `404` for resources that do not exist or do not belong to the current user.
- Run focused tests first, then broaden to `npm run typecheck`, `npm run lint`, and `npm test` when
  the change affects shared behavior.

More project-specific agent guidance lives in `AGENTS.md`.

## License

MIT
