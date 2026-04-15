import type { FastifyInstance } from 'fastify'
import type { Job, WorkHandler, WorkOptions } from 'pg-boss'
import { defineScheduledBossWorker } from './types.ts'

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

export const onThisDayWorkerDefinition = defineScheduledBossWorker<OnThisDayJobData>({
  createWorker: createOnThisDayWorker,
  name: 'on-this-day',
  queue: ON_THIS_DAY_QUEUE,
  schedule: (config) => ({
    cron: config.pgBoss.onThisDayCron,
    data: {},
    options: {
      tz: config.pgBoss.onThisDayTimezone,
    },
  }),
  workOptions: onThisDayWorkerOptions,
})
