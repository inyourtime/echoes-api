# Agent Guide

This file is the working guide for AI agents contributing to `echoes-api`.

## Project Snapshot

`echoes-api` is a TypeScript ESM backend for the Echoes music life timeline app. It uses
Fastify, TypeBox schemas, Drizzle ORM, PostgreSQL, Node's built-in test runner, and Biome.

The API is built around music timeline entries:

- users authenticate with OAuth or email/password flows
- tracks are deduplicated with normalized title/artist fields
- user tracks hold a user's listening memory, note, YouTube URL, date, and tags
- stats, push notifications, mail, and "on this day" jobs live alongside the core API

## Commands

Use the existing npm scripts rather than inventing new command lines.

```bash
npm run dev              # start the API with .env and file watching
npm run build            # compile TypeScript into dist/
npm run typecheck        # run TypeScript without emitting
npm run lint             # run Biome checks
npm run lint:fix         # apply Biome fixes
npm test                 # build, then run unit tests
npm run test:unit        # run tests/**/*.test.ts
npm run test:e2e         # build, then run e2e/**/*.test.ts serially
npm run coverage         # run tests with Node test coverage
npm run db:migrate       # generate Drizzle migration files
npm run db:push          # push current schema to the database
npm run generate:openapi # regenerate openapi.yaml from Fastify schemas
```

The project targets Node `25` and uses `package-lock.json`; keep dependency changes lockfile-backed.

## Repository Layout

- `src/app.ts` builds the Fastify instance, registers plugins, health, routes, and static fallback.
- `src/index.ts` is the runtime entry point.
- `src/config/index.ts` owns environment parsing and the `IConfig` contract.
- `src/db/schema.ts` contains Drizzle table definitions and shared DB types.
- `src/db/relations.ts` defines Drizzle relation metadata.
- `src/plugins/` contains Fastify plugins and decorated services.
- `src/plugins/repositories/` contains repository classes and Fastify decorations.
- `src/routes/<feature>/index.ts` contains route handlers.
- `src/routes/<feature>/schema.ts` contains TypeBox request/response schemas.
- `tests/` contains unit/integration tests using Fastify injection.
- `e2e/` contains Testcontainers-backed end-to-end tests.
- `migrations/` contains generated Drizzle migrations; do not hand-edit snapshots casually.

## Coding Style

- Use TypeScript ESM imports with explicit `.ts` extensions for local source imports.
- Follow Biome formatting: 2 spaces, single quotes, no semicolons, 100 character line width.
- Prefer TypeBox schemas for API input/output contracts.
- Keep route files thin: validation, auth/ownership checks, repository calls, and response shaping.
- Put database-heavy logic in repositories, not in route handlers.
- Use Fastify decorations from plugins instead of constructing shared services ad hoc.
- Use `request.getUser().sub` for authenticated user identity after `config: { auth: true }`.
- Return `404` for resources that do not exist or do not belong to the current user.
- Prefer `app.httpErrors.*` for HTTP errors.
- Preserve the established response envelope style, such as `{ userTrack }`, `{ userTracks, meta }`.
- Keep comments sparse and useful. Existing Thai comments are intentional domain/auth notes; do not
  remove or translate them unless the nearby code is being rewritten for a good reason.

## API And Schema Patterns

Routes are autoloaded from `src/routes` with the `/api/v1` prefix and no directory-name prefix.
Each feature generally has:

- `index.ts` exporting a `TypedRoutePlugin`
- `schema.ts` exporting TypeBox schemas
- OpenAPI metadata in the route's `schema` object
- shared error response refs from `responses#/properties/...`

When adding or changing endpoints:

- add or update TypeBox request/response schemas first
- include OpenAPI `tags`, `summary`, and useful `description`
- keep auth-protected endpoints marked with `config: { auth: true }`
- validate resource ownership before mutation or detail reads
- update tests for success, validation, auth, and ownership/error behavior as appropriate
- regenerate `openapi.yaml` when the public API contract changes

## Database And Migrations

Drizzle schema lives in `src/db/schema.ts`; relations live in `src/db/relations.ts`.

When changing tables, columns, indexes, enums, or generated columns:

1. Update the Drizzle schema and relation metadata.
2. Run `npm run db:migrate` to generate a migration.
3. Review the generated SQL and snapshot for correctness.
4. Add or update tests around behavior that depends on the schema change.

Do not use `npm run db:push` as a substitute for committed migrations.

## Testing Guidance

Unit/integration tests use Node's test runner and Fastify `app.inject`.

- `tests/helper.ts` provides `buildTestApp`, `mockConfig`, MSW setup, and
  `injectWithAccessToken`.
- Use `buildTestApp()` for tests that do not need a real DB connection.
- Use the existing e2e helpers for Testcontainers-backed database flows.
- Mock external HTTP calls with MSW handlers.
- Keep tests close to the feature path, for example `tests/routes/auth/login.test.ts`.

Run the narrowest meaningful command first, then broaden before finishing:

```bash
npm run typecheck
npm run lint
npm test
```

For a single unit file, match the existing Node test flags:

```bash
node --experimental-test-module-mocks --localstorage-file ./tests/.localstorage --test tests/routes/push/index.test.ts
```

## OpenAPI

`openapi.yaml` is generated from the Fastify/TypeBox route schemas.

If an endpoint contract changes, run:

```bash
npm run generate:openapi
```

Review generated output and avoid unrelated churn.

## Environment Notes

Runtime configuration is parsed from environment variables in `src/config/index.ts`.
Development scripts load `.env` with `node --env-file=.env`.

Tests commonly disable real DB and job behavior through `mockConfig`:

- `enableDbConnection: false`
- `pgBoss.enabled: false`
- fake OAuth, JWT, mailer, and Firebase settings

Avoid adding required environment variables without updating config defaults, README/docs, tests, and
deployment expectations.

## Safe Change Checklist

Before handing off a code change:

- run the relevant focused tests
- run `npm run typecheck` for TypeScript-sensitive changes
- run `npm run lint` or `npm run lint:fix` for formatting/import updates
- run `npm test` for route, repository, auth, or schema changes with broad impact
- regenerate `openapi.yaml` if API schemas changed
- mention any commands that could not be run and why

## Things To Avoid

- Do not edit generated `dist/` output.
- Do not hand-edit migration snapshots unless you are intentionally correcting generated metadata.
- Do not bypass repositories for normal route persistence logic.
- Do not silently widen auth or ownership access.
- Do not introduce a new validation library; TypeBox is the project standard.
- Do not replace Node's test runner with another test framework.
- Do not commit secrets, `.env`, local database files, or test artifacts such as local storage files.
