import { PgBoss } from 'pg-boss'
import { definePlugin } from '../utils/factories.ts'
import { bossWorkerRegistry } from '../workers/index.ts'

declare module 'fastify' {
  interface FastifyInstance {
    pgBoss: PgBoss | null
  }
}

const plugin = definePlugin(
  {
    name: 'pg-boss',
    dependencies: ['db', 'on-this-day-service'],
  },
  async (app, { config }) => {
    app.decorate('pgBoss', null)

    if (!config.enableDbConnection || !config.pgBoss.enabled) {
      app.log.info('pg-boss disabled')
      return
    }

    const boss = new PgBoss(process.env.POSTGRES_URL!)

    boss.on('error', (error) => {
      app.log.error({ err: error }, 'pg-boss error')
    })

    boss.on('wip', (workers) => {
      app.log.debug(workers, 'pg-boss workers in progress')
    })

    boss.on('stopped', () => {
      app.log.info('pg-boss stopped')
    })

    await boss.start()
    for (const worker of bossWorkerRegistry) {
      await boss.createQueue(worker.queue)

      const schedule = worker.schedule?.(config)
      if (schedule) {
        await boss.schedule(worker.queue, schedule.cron, schedule.data, schedule.options)
      }

      await boss.work(worker.queue, worker.workOptions ?? {}, worker.createWorker(app))
    }

    app.pgBoss = boss
    app.log.info(
      {
        workers: bossWorkerRegistry.map((worker) => ({
          name: worker.name,
          queue: worker.queue,
          schedule: worker.schedule?.(config)?.cron ?? null,
          timezone: worker.schedule?.(config)?.options?.tz ?? null,
        })),
      },
      'pg-boss started',
    )

    app.addHook('onClose', async () => {
      if (!app.pgBoss) {
        return
      }

      for (const worker of bossWorkerRegistry) {
        await app.pgBoss.offWork(worker.queue)
      }

      await app.pgBoss.stop()
    })
  },
)

export default plugin
