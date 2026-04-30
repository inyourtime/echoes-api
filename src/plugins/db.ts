import { db } from '../db/index.ts'
import { definePlugin } from '../utils/factories.ts'

/**
 * Plugin for database connection
 *
 * @remarks
 * This plugin connects to the database and closes the connection when the server is closed.
 */
const plugin = definePlugin(
  {
    name: 'db',
  },
  async (app, { config }) => {
    const enableDbConnection = config.enableDbConnection ?? true

    if (enableDbConnection) {
      await db.execute('SELECT 1')
      app.log.info('Connected to database')
    }

    app.addHook('onClose', async () => {
      if (enableDbConnection && !db.$client.ended) {
        await db.$client.end()
        app.log.info('Disconnected from database')
      }
    })
  },
)

export default plugin
