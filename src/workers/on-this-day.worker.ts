import type { FastifyInstance } from 'fastify'
import { definePgBossWorker } from 'fastify-pg-boss'
import type { Job, WorkHandler, WorkOptions } from 'pg-boss'
import type { IConfig } from '../config/index.ts'

export const ON_THIS_DAY_QUEUE = 'notifications/on-this-day/daily'

export type OnThisDayJobData = {
  date?: string
  urlTemplate?: string
}

export const onThisDayWorkerOptions: WorkOptions = {
  pollingIntervalSeconds: 10,
}

export function createOnThisDayWorker(app: FastifyInstance): WorkHandler<OnThisDayJobData> {
  return async (jobs: Job<OnThisDayJobData>[]) => {
    for (const job of jobs) {
      app.log.info({ jobId: job.id, queue: job.name }, 'Processing On This Day notifications')

      const result = await app.onThisDayService.sendToAllUsers({
        date: job.data?.date ? new Date(job.data.date) : undefined,
        urlTemplate: job.data?.urlTemplate,
      })

      app.log.info(
        {
          ...result,
          jobId: job.id,
          queue: job.name,
        },
        'Processed On This Day notifications',
      )
    }
  }
}

export function createOnThisDayWorkerDefinition(config: IConfig) {
  return definePgBossWorker<OnThisDayJobData>((app) => ({
    createQueue: true,
    handler: createOnThisDayWorker(app),
    name: 'on-this-day',
    options: onThisDayWorkerOptions,
    queue: ON_THIS_DAY_QUEUE,
    schedule: {
      cron: config.pgBoss.onThisDayCron,
      data: {},
      options: {
        tz: config.pgBoss.onThisDayTimezone,
      },
    },
  }))
}

export function getOnThisDayWorkerLogEntry(config: IConfig) {
  return {
    name: 'on-this-day',
    queue: ON_THIS_DAY_QUEUE,
    schedule: config.pgBoss.onThisDayCron,
    timezone: config.pgBoss.onThisDayTimezone,
  }
}
