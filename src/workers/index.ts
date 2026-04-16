import { onThisDayWorkerDefinition } from './on-this-day.worker.ts'
import type { BossWorkerDefinition } from './types.ts'

export const bossWorkerRegistry: BossWorkerDefinition[] = [onThisDayWorkerDefinition]
