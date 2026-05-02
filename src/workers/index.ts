import type { FastifyInstance } from 'fastify'
import type { IConfig } from '../config/index.ts'
import { createMailWorkerDefinition } from './mail.worker.ts'
import { createOnThisDayWorkerDefinition } from './on-this-day.worker.ts'

export { type BossQueues, bossQueueRegistry } from './queues.ts'

export function getBossWorkers(app: FastifyInstance, config: IConfig) {
  return [createMailWorkerDefinition(app), createOnThisDayWorkerDefinition(app, config)]
}

type BossWorker = ReturnType<typeof getBossWorkers>[number]

export function getBossWorkerLogEntries(workers: readonly BossWorker[]) {
  return workers.map(({ name, queue, schedule }) => ({
    name,
    queue,
    ...getScheduleLogEntry(schedule),
  }))
}

function getScheduleLogEntry(schedule: BossWorker['schedule']) {
  if (!schedule) {
    return {}
  }

  if (typeof schedule === 'string') {
    return { schedule }
  }

  return {
    schedule: schedule.cron,
    timezone: schedule.tz ?? schedule.options?.tz,
  }
}
