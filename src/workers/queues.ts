import { definePgBossQueues, type PgBossQueuesFromRegistry, queue } from 'fastify-pg-boss'
import type { SendOptions } from 'pg-boss'

export const MAIL_QUEUE = 'mail/send'
export const ON_THIS_DAY_QUEUE = 'notifications/on-this-day/daily'

export type MailJobData =
  | {
      email: string
      type: 'verification'
      verificationLink: string
    }
  | {
      email: string
      resetLink: string
      type: 'password_reset'
    }

export type OnThisDayJobData = {
  date?: string
  urlTemplate?: string
}

export const mailQueueOptions = {
  retryBackoff: true,
  retryLimit: 3,
} satisfies SendOptions

export const bossQueueRegistry = definePgBossQueues({
  [MAIL_QUEUE]: queue<MailJobData>({
    create: true,
    options: mailQueueOptions,
  }),
  [ON_THIS_DAY_QUEUE]: queue<OnThisDayJobData>({
    create: true,
  }),
})

export type BossQueues = PgBossQueuesFromRegistry<typeof bossQueueRegistry>

declare module 'fastify-pg-boss' {
  interface PgBossQueues extends BossQueues {}
}
