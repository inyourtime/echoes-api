import type { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index.ts'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

export const db = drizzle(pool, { schema })

type Schema = typeof schema
type TSchema = ExtractTablesWithRelations<Schema>

export type InferQueryResult<
  TTable extends keyof TSchema,
  TConfig extends DBQueryConfig<'many', true, TSchema, TSchema[TTable]>,
> = BuildQueryResult<TSchema, TSchema[TTable], TConfig>
