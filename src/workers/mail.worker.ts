import type { FastifyInstance } from 'fastify'
import { definePgBossWorker } from 'fastify-pg-boss'
import type { Job, WorkHandler, WorkOptions } from 'pg-boss'

export const MAIL_QUEUE = 'mail/send'

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

export const mailWorkerOptions: WorkOptions = {
  pollingIntervalSeconds: 5,
}

export const mailQueueOptions = {
  retryBackoff: true,
  retryLimit: 3,
}

export function createMailWorker(app: FastifyInstance): WorkHandler<MailJobData> {
  return async (jobs: Job<MailJobData>[]) => {
    for (const job of jobs) {
      app.log.info({ jobId: job.id, queue: job.name, type: job.data.type }, 'Processing mail job')

      switch (job.data.type) {
        case 'verification':
          await app.mailerService.deliverVerification(job.data.email, job.data.verificationLink)
          break
        case 'password_reset':
          await app.mailerService.deliverPasswordReset(job.data.email, job.data.resetLink)
          break
      }

      app.log.info({ jobId: job.id, queue: job.name, type: job.data.type }, 'Processed mail job')
    }
  }
}

export function createMailWorkerDefinition() {
  return definePgBossWorker<MailJobData>((app) => ({
    createQueue: true,
    handler: createMailWorker(app),
    name: 'mail',
    options: mailWorkerOptions,
    queue: MAIL_QUEUE,
    queueOptions: mailQueueOptions,
  }))
}

export function getMailWorkerLogEntry() {
  return {
    name: 'mail',
    queue: MAIL_QUEUE,
  }
}
