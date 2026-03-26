import type { TestContext } from 'node:test'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer | undefined

export async function startTestDatabase(): Promise<{
  connectionString: string
  stop: () => Promise<void>
}> {
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start()

  const connectionString = container.getConnectionUri()

  return {
    connectionString,
    stop: async () => {
      if (container) {
        await container.stop()
        container = undefined
      }
    },
  }
}

export function setupTestDatabase(testContext: TestContext) {
  let stopDatabase: (() => Promise<void>) | undefined

  testContext.before(async () => {
    const { connectionString, stop } = await startTestDatabase()
    process.env.POSTGRES_URL = connectionString
    stopDatabase = stop
  })

  testContext.after(async () => {
    if (stopDatabase) {
      await stopDatabase()
    }
  })
}
