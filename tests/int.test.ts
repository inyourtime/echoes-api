import test from 'node:test'
import { startTestDatabase } from './database.ts'
import { mockConfig } from './helper.ts'

test('integration test with database', async () => {
  // Start test database container
  const { connectionString, stop } = await startTestDatabase()
  console.log('connectionString', connectionString)

  // Set environment variable before importing any db-dependent modules
  process.env.POSTGRES_URL = connectionString

  // Dynamically import db-dependent modules after env is set
  const { buildApp } = await import('../src/app.ts')

  const app = await buildApp(mockConfig)
  console.log('app ready')
  await app.ready()
  console.log('app ready2')
  // Test routes are loaded
  const routes = app.printRoutes()
  console.log('routes', routes)

  await app.close()

  // Stop the test database container
  await stop()

  console.log('database closed')
  console.log('app and database closed successfully')
})
