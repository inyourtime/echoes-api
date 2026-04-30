import assert from 'node:assert/strict'
import { describe, mock, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { Job } from 'pg-boss'
import { MailerService } from '../../src/plugins/mailer.ts'
import {
  createMailWorker,
  MAIL_QUEUE,
  type MailJobData,
  mailQueueOptions,
} from '../../src/workers/mail.worker.ts'
import { mockConfig } from '../helper.ts'

describe('MailerService', () => {
  test('should enqueue verification emails when pg-boss is available', async () => {
    const sendMock = mock.fn(async (_queue: string, _data: object, _options: object) => 'job-id')
    const app = {
      pgBoss: {
        send: sendMock,
      },
    } as unknown as FastifyInstance
    const mailerService = new MailerService(app, mockConfig)

    await mailerService.sendVerification('user@example.com', 'http://localhost/verify')

    assert.strictEqual(sendMock.mock.callCount(), 1)
    assert.strictEqual(sendMock.mock.calls[0].arguments[0], MAIL_QUEUE)
    assert.deepStrictEqual(sendMock.mock.calls[0].arguments[1], {
      email: 'user@example.com',
      type: 'verification',
      verificationLink: 'http://localhost/verify',
    })
    assert.deepStrictEqual(sendMock.mock.calls[0].arguments[2], mailQueueOptions)
  })

  test('should enqueue password reset emails when pg-boss is available', async () => {
    const sendMock = mock.fn(async (_queue: string, _data: object, _options: object) => 'job-id')
    const app = {
      pgBoss: {
        send: sendMock,
      },
    } as unknown as FastifyInstance
    const mailerService = new MailerService(app, mockConfig)

    await mailerService.sendPasswordReset('user@example.com', 'http://localhost/reset')

    assert.strictEqual(sendMock.mock.callCount(), 1)
    assert.strictEqual(sendMock.mock.calls[0].arguments[0], MAIL_QUEUE)
    assert.deepStrictEqual(sendMock.mock.calls[0].arguments[1], {
      email: 'user@example.com',
      resetLink: 'http://localhost/reset',
      type: 'password_reset',
    })
    assert.deepStrictEqual(sendMock.mock.calls[0].arguments[2], mailQueueOptions)
  })
})

describe('mail worker', () => {
  test('should deliver queued verification and password reset emails', async () => {
    const deliverVerificationMock = mock.fn(async (_email: string, _verificationLink: string) => {})
    const deliverPasswordResetMock = mock.fn(async (_email: string, _resetLink: string) => {})
    const app = {
      log: {
        info: mock.fn(),
      },
      mailerService: {
        deliverPasswordReset: deliverPasswordResetMock,
        deliverVerification: deliverVerificationMock,
      },
    } as unknown as FastifyInstance
    const worker = createMailWorker(app)

    await worker([
      {
        data: {
          email: 'verify@example.com',
          type: 'verification',
          verificationLink: 'http://localhost/verify',
        },
        id: 'job-1',
        name: MAIL_QUEUE,
      } as unknown as Job<MailJobData>,
      {
        data: {
          email: 'reset@example.com',
          resetLink: 'http://localhost/reset',
          type: 'password_reset',
        },
        id: 'job-2',
        name: MAIL_QUEUE,
      } as unknown as Job<MailJobData>,
    ])

    assert.strictEqual(deliverVerificationMock.mock.callCount(), 1)
    assert.deepStrictEqual(deliverVerificationMock.mock.calls[0].arguments, [
      'verify@example.com',
      'http://localhost/verify',
    ])
    assert.strictEqual(deliverPasswordResetMock.mock.callCount(), 1)
    assert.deepStrictEqual(deliverPasswordResetMock.mock.calls[0].arguments, [
      'reset@example.com',
      'http://localhost/reset',
    ])
  })
})
