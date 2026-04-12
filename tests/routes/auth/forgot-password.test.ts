import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { User } from '../../../src/db/schema.ts'
import { buildTestApp } from '../../helper.ts'

const userId = 'user-1'
const forgotPasswordPayload = {
  email: 'TEST@example.com',
}
const normalizedEmail = 'test@example.com'
const successMessage = 'If an account exists, a password reset email has been sent.'

type CreateVerificationTokenInput = {
  userId: string
  type: 'password_reset'
  tokenHash: string
  expiresAt: Date
}

function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: normalizedEmail,
    emailVerifiedAt: new Date(),
    passwordHash: 'existing-password-hash',
    name: 'Test User',
    avatarUrl: null,
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /auth/forgot-password', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function injectForgotPassword() {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: forgotPasswordPayload,
    })
  }

  test('should return success without side effects when user does not exist', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const deleteByUserAndTypeMock = mock.fn(async (_userId: string, _type: string) => undefined)
    const createVerificationTokenMock = mock.fn(async (_input: CreateVerificationTokenInput) => {
      throw new Error('create should not be called')
    })
    const sendPasswordResetMock = mock.fn(async (_email: string, _resetUrl: string) => {
      throw new Error('sendPasswordReset should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.verificationTokenRepository.deleteByUserAndType =
      deleteByUserAndTypeMock as unknown as typeof app.verificationTokenRepository.deleteByUserAndType
    app.verificationTokenRepository.create = createVerificationTokenMock
    app.mailerService.sendPasswordReset = sendPasswordResetMock

    const response = await injectForgotPassword()

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      message: successMessage,
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(deleteByUserAndTypeMock.mock.callCount(), 0)
    assert.strictEqual(createVerificationTokenMock.mock.callCount(), 0)
    assert.strictEqual(sendPasswordResetMock.mock.callCount(), 0)
  })

  test('should return success without side effects when user is inactive', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture({
        isActive: false,
      })
    })
    const deleteByUserAndTypeMock = mock.fn(async (_userId: string, _type: string) => undefined)
    const createVerificationTokenMock = mock.fn(async (_input: CreateVerificationTokenInput) => {
      throw new Error('create should not be called')
    })
    const sendPasswordResetMock = mock.fn(async (_email: string, _resetUrl: string) => {
      throw new Error('sendPasswordReset should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.verificationTokenRepository.deleteByUserAndType =
      deleteByUserAndTypeMock as unknown as typeof app.verificationTokenRepository.deleteByUserAndType
    app.verificationTokenRepository.create = createVerificationTokenMock
    app.mailerService.sendPasswordReset = sendPasswordResetMock

    const response = await injectForgotPassword()

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      message: successMessage,
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(deleteByUserAndTypeMock.mock.callCount(), 0)
    assert.strictEqual(createVerificationTokenMock.mock.callCount(), 0)
    assert.strictEqual(sendPasswordResetMock.mock.callCount(), 0)
  })

  test('should replace existing reset token and send password reset email for active user', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture()
    })
    const deleteByUserAndTypeMock = mock.fn(async (_userId: string, _type: string) => undefined)
    const createVerificationTokenMock = mock.fn(async (_input: CreateVerificationTokenInput) => {
      return {
        id: 'verification-token-1',
        userId,
        type: 'password_reset' as const,
        tokenHash: 'token-hash',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      }
    })
    const sendPasswordResetMock = mock.fn(async (_email: string, _resetUrl: string) => {})

    app.userRepository.findByEmail = findByEmailMock
    app.verificationTokenRepository.deleteByUserAndType =
      deleteByUserAndTypeMock as unknown as typeof app.verificationTokenRepository.deleteByUserAndType
    app.verificationTokenRepository.create = createVerificationTokenMock
    app.mailerService.sendPasswordReset = sendPasswordResetMock

    const now = Date.now()
    const response = await injectForgotPassword()

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      message: successMessage,
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)

    assert.strictEqual(deleteByUserAndTypeMock.mock.callCount(), 1)
    const deleteByUserAndTypeArgs = deleteByUserAndTypeMock.mock.calls[0].arguments
    assert.strictEqual(deleteByUserAndTypeArgs[0], userId)
    assert.strictEqual(deleteByUserAndTypeArgs[1], 'password_reset')

    assert.strictEqual(createVerificationTokenMock.mock.callCount(), 1)
    const createVerificationTokenArgs = createVerificationTokenMock.mock.calls[0].arguments
    assert.strictEqual(createVerificationTokenArgs[0].userId, userId)
    assert.strictEqual(createVerificationTokenArgs[0].type, 'password_reset')
    assert.match(createVerificationTokenArgs[0].tokenHash, /^[0-9a-f]{64}$/)
    assert.ok(createVerificationTokenArgs[0].expiresAt instanceof Date)
    assert.ok(createVerificationTokenArgs[0].expiresAt.getTime() > now)

    assert.strictEqual(sendPasswordResetMock.mock.callCount(), 1)
    const sendPasswordResetArgs = sendPasswordResetMock.mock.calls[0].arguments
    assert.strictEqual(sendPasswordResetArgs[0], normalizedEmail)
    assert.match(
      sendPasswordResetArgs[1],
      /^http:\/\/localhost:3000\/reset-password\?token=[0-9a-f]{64}$/,
    )
  })
})
