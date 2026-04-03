# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Fastify application. Use `src/app.ts` for app assembly, `src/index.ts` for startup, `src/config/` for env parsing, `src/db/` for Drizzle schema/relations, `src/plugins/` for Fastify plugins and repositories, and `src/routes/<feature>/` for endpoint modules with paired `index.ts` and `schema.ts` files. Tests live in `tests/`, migrations in `migrations/`, generated API output in `openapi.yaml`, and maintenance scripts in `scripts/` or `src/scripts/`. Project notes are in `README.md`, `PROJECT.md`, `PLAN.md`, and `FEATURE.md`.

## Build, Test, and Development Commands
Use Node 25 as declared in `package.json`.

- `npm run dev` starts the API with `--watch` and `.env`.
- `npm run build` compiles TypeScript into `dist/`.
- `npm run start` builds and runs the production entrypoint.
- `npm run typecheck` runs strict TypeScript checks without emitting files.
- `npm run lint` checks formatting and lint rules with Biome.
- `npm run lint:fix` applies Biome fixes.
- `npm run test` builds first, then runs the Node test runner.
- `npm run coverage` runs tests with coverage enabled.
- `npm run db:push` syncs schema changes to PostgreSQL.
- `npm run db:migrate` generates a new Drizzle migration.
- `npm run generate:openapi` refreshes `openapi.yaml`.

For local database setup, `docker compose up -d` starts PostgreSQL on `localhost:5432`.

## Coding Style & Naming Conventions
This codebase uses TypeScript ESM with `strict` mode. Follow Biome defaults in `biome.json`: 2-space indentation, single quotes, LF endings, 100-column width, and no semicolons. Prefer descriptive camelCase for variables/functions, PascalCase for types, and feature-aligned folder names such as `user-tracks` or `auth`. Keep route schemas beside handlers, and keep shared DB access in repository plugins instead of route files.

## Testing Guidelines
Tests use the built-in `node:test` runner. Name test files `*.test.ts` and place them under `tests/`; examples include `tests/plugins/auth.test.ts` and `tests/utils/hash.test.ts`. Integration coverage uses Testcontainers-backed PostgreSQL, so ensure Docker is available before running `npm run test` or `npm run coverage`. Add or update tests for every behavior change, especially auth, repositories, and route schemas.

## Commit & Pull Request Guidelines
Recent history favors short, imperative subjects with Conventional Commit-style prefixes such as `feat:` and `fix:`. Keep commits focused and mention the affected area when useful, for example `feat: add track metadata endpoint`. PRs should summarize the behavior change, note any new env vars or migrations, link related issues, and include example request or response payloads when API behavior changes. Regenerate `openapi.yaml` when endpoints or schemas change.
