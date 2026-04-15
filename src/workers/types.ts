import type { FastifyInstance } from 'fastify'
import type { ScheduleOptions, WorkHandler, WorkOptions } from 'pg-boss'
import type { IConfig } from '../config/index.ts'

export type BossWorkerSchedule<Data = object> = {
  cron: string
  data?: Data | null
  options?: ScheduleOptions
}

export type BossWorkerDefinition<Data = object> = {
  createWorker: (app: FastifyInstance) => WorkHandler<Data>
  name: string
  queue: string
  schedule?: (config: IConfig) => BossWorkerSchedule<Data> | null
  workOptions?: WorkOptions
}

export function defineBossWorker<Data = object>(definition: BossWorkerDefinition<Data>) {
  return definition
}

export type ScheduledBossWorkerDefinition<Data = object> = Omit<
  BossWorkerDefinition<Data>,
  'schedule'
> & {
  schedule: (config: IConfig) => BossWorkerSchedule<Data> | null
}

export function defineScheduledBossWorker<Data = object>(
  definition: ScheduledBossWorkerDefinition<Data>,
) {
  return defineBossWorker(definition)
}
