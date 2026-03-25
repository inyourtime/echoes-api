# Echoes API - Developer Skills & Conventions

This document outlines the coding standards, architectural patterns, and technology stack conventions for the **Echoes API** project. It serves as a guide for AI agents and developers to maintain consistency across the codebase.

## 🛠️ Technology Stack
- **Runtime:** Node.js (with Native Test Runner `--experimental-test-module-mocks --experimental-test-coverage --test`)
- **Web Framework:** [Fastify](https://fastify.dev/) (v5)
- **Validation & Typing:** [TypeBox](https://github.com/sinclairzx81/typebox)
- **Database ORM:** [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL (`pg`)
- **Linting & Formatting:** [Biome](https://biomejs.dev/)
- **Language:** TypeScript (NodeNext resolution, ESNext target, Strict Mode)

---

## 🎨 Code Style & Formatting (Biome)
The project dictates code formatting via `biome.json`:
- **Quotes:** Single quotes (`'`)
- **Semicolons:** As needed (Omit semicolons at the end of statements)
- **Indentation:** 2 Spaces (`indentStyle: "space"`, `indentWidth: 2`)
- **Line Width:** 100 characters max
- **Trailing Commas:** Default Biome behavior (usually ES5/all)

*Note: Avoid `any` where possible, though Biome suppresses strict checking for `noExplicitAny` in this configuration. Treat unused variables as warnings.*

---

## 🏗️ Architecture & Project Structure

The project follows a modular, plugin-based architecture tailored for Fastify:

### Directory Structure
- `/src/app.ts`: Core application builder. Registers essential plugins and sets up the TypeBox type provider.
- `/src/index.ts`: Application entry point. Handles graceful shutdown (`close-with-grace`) and server instantiation.
- `/src/config/`: Configuration loaders and environment variable schemas.
- `/src/db/`: Database configuration and ORM tools.
  - `/src/db/schema/`: Drizzle ORM schema definitions. Grouped logically with relations exported consistently.
- `/src/plugins/`: Fastify plugins globally loaded via `@fastify/autoload`.
- `/src/routes/`: API route definitions globally loaded via `@fastify/autoload` with a `/api/v1` prefix.
- `/src/utils/`: Shared utilities, factory functions, types, etc.

---

## 📝 Design Patterns & Conventions

### 1. Route Definitions
Routes are defined using a custom factory function `defineRoute` located in `src/utils/factories.ts`. This encapsulates plugins and route scoping securely.

**Pattern:**
```typescript
import { defineRoute } from "../utils/factories.ts"

const route = defineRoute(
  {
    prefix: '/resource', // The URL path suffix inside /api/v1
    tags: ['resource'],  // Swagger documentation tags
  },
  async (app) => {
    // Endpoints go here
    app.get('/', {
      schema: { /* TypeBox schema here */ }
    }, async (request, reply) => {
      return { success: true }
    })
  }
)

export default route
```

### 2. Fastify Plugins
Custom plugins use the custom `definePlugin` factory to ensure the `fastify-plugin` wrapper is applied consistently.

**Pattern:**
```typescript
import { definePlugin } from '../utils/factories.ts'

const myPlugin = definePlugin(
  {
    name: 'custom-plugin',
    // dependencies: ['db']
  },
  async (app, options) => {
    // Plugin logic here
  }
)

export default myPlugin
```

### 3. Database Schema (Drizzle ORM)
Schemas are defined in `/src/db/schema/` and mapped to PostgreSQL data types using Drizzle definitions.
- **Primary Keys:** Exclusively using `uuid()` with `.defaultRandom()`.
- **Timestamps:** Standardized `createdAt` (`.defaultNow()`) and `updatedAt` (`.defaultNow().$onUpdate(() => new Date())`).
- **Relations:** Explicitly defined using Drizzle's `relations` function.
- **Indexes:** Extensively used for foreign keys, uniqueness, and optimized querying using closures at the end of `pgTable`.

**Pattern:**
```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  }
)

export const entitiesRelations = relations(entities, ({ many }) => ({
  // Relations defined here
}))

export type Entity = typeof entities.$inferSelect
export type NewEntity = typeof entities.$inferInsert
```

### 4. Input & Output Validation
All requests (body, querystring, params, headers) and responses **must** be validated strictly using **TypeBox** definitions injected into Fastify schemas seamlessly without manual assertions. Relying on `TypeBoxTypeProvider` ensures full type inference in route handlers.

### 5. ES Modules & Import Extensions
The project uses strict ES Module features. Imports using relative paths **must** include the `.ts` extension per TypeScript `NodeNext` rules and `rewriteRelativeImportExtensions: true` settings.
- Example: `import foo from './utils/foo.ts'`

## ✅ Testing
Tests run natively via the Node.js Test Runner. When writing tests, utilize `node:test` and `node:assert`. Test coverage uses `--experimental-test-coverage`.
