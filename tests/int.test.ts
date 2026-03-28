import test from 'node:test'
import { startTestDatabase } from './database.ts'
import { mockConfig } from './helper.ts'

test('integration test with database', async () => {
  // Start test database container
  const { connectionString, stop } = await startTestDatabase()

  // Set environment variable before importing any db-dependent modules
  process.env.POSTGRES_URL = connectionString

  // Dynamically import db-dependent modules after env is set
  const { buildApp } = await import('../src/app.ts')

  const app = await buildApp(mockConfig)
  await app.ready()

  await app.close()

  // Stop the test database container
  await stop()
})
