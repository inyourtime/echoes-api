import type { FastifyInstance } from 'fastify'
import type { Job, WorkHandler, WorkOptions } from 'pg-boss'
import { bossQueueRegistry, MAIL_QUEUE, type MailJobData } from './queues.ts'

export { MAIL_QUEUE, type MailJobData, mailQueueOptions } from './queues.ts'

export const mailWorkerOptions: WorkOptions = {
  pollingIntervalSeconds: 5,
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
  return bossQueueRegistry.worker(MAIL_QUEUE, (app) => ({
    handler: createMailWorker(app),
    name: 'mail',
    options: mailWorkerOptions,
  }))
}

export function getMailWorkerLogEntry() {
  return {
    name: 'mail',
    queue: MAIL_QUEUE,
  }
}
