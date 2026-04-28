import fastifyPgBoss from 'fastify-pg-boss'
import { definePlugin } from '../utils/factories.ts'
import { getBossWorkerLogEntries, getBossWorkers } from '../workers/index.ts'

const plugin = definePlugin(
  {
    name: 'pg-boss',
    dependencies: ['db', 'on-this-day-service'],
  },
  async (app, { config }) => {
    const enabled = Boolean(config.enableDbConnection && config.pgBoss.enabled)

    await app.register(fastifyPgBoss, {
      enabled,
      connectionString: process.env.POSTGRES_URL,
      workers: getBossWorkers(config),
      events: {
        wip(app, workers) {
          app.log.debug(workers, 'pg-boss workers in progress')
        },
        stopped(app) {
          app.log.info('pg-boss stopped')
        },
      },
    })

    if (!enabled) {
      return
    }

    app.log.info(
      {
        workers: getBossWorkerLogEntries(config),
      },
      'pg-boss started',
    )
  },
)

export default plugin
