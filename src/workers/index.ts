import type { IConfig } from '../config/index.ts'
import { createMailWorkerDefinition, getMailWorkerLogEntry } from './mail.worker.ts'
import {
  createOnThisDayWorkerDefinition,
  getOnThisDayWorkerLogEntry,
} from './on-this-day.worker.ts'

export { type BossQueues, bossQueueRegistry } from './queues.ts'

export function getBossWorkers(config: IConfig) {
  return [createMailWorkerDefinition(), createOnThisDayWorkerDefinition(config)]
}

export function getBossWorkerLogEntries(config: IConfig) {
  return [getMailWorkerLogEntry(), getOnThisDayWorkerLogEntry(config)]
}
