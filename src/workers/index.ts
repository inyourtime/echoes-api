import type { IConfig } from '../config/index.ts'
import {
  createOnThisDayWorkerDefinition,
  getOnThisDayWorkerLogEntry,
} from './on-this-day.worker.ts'

export function getBossWorkers(config: IConfig) {
  return [createOnThisDayWorkerDefinition(config)]
}

export function getBossWorkerLogEntries(config: IConfig) {
  return [getOnThisDayWorkerLogEntry(config)]
}
