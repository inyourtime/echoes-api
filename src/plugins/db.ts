import { db } from '#db/index'
import { definePlugin } from '#utils/factories'

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
    if (config.enableDbConnection) {
      await db.execute('SELECT 1')
      app.log.info('Connected to database')
    }

    app.addHook('onClose', async () => {
      await db.$client.end()
      app.log.info('Disconnected from database')
    })
  },
)

export default plugin
