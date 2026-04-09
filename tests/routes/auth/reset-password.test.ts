import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { User } from '../../../src/db/schema.ts'
import { hashToken, verifyPassword } from '../../../src/utils/hash.ts'
import { buildTestApp } from '../../helper.ts'

const token = 'password-reset-token'
const tokenHash = hashToken(token)
const verificationRecordId = 'verification-record-1'
const userId = 'user-1'
const newPassword = 'new-password-123'
const successMessage = 'Password reset successful. You can now log in.'

function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: 'test@example.com',
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

function createVerificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: verificationRecordId,
    userId,
    type: 'password_reset' as const,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    user: createUserFixture(),
    ...overrides,
  }
}

describe('POST /auth/reset-password', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function injectResetPassword() {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token,
        password: newPassword,
      },
    })
  }

  test('should return bad request when token does not exist', async () => {
    const findByTokenHashMock = mock.fn(async (_tokenHash: string) => undefined)
    const markAsUsedMock = mock.fn(async (_id: string) => undefined)
    const updatePasswordMock = mock.fn(async (_id: string, _passwordHash: string) => undefined)

    app.verificationTokenRepository.findByTokenHash =
      findByTokenHashMock as typeof app.verificationTokenRepository.findByTokenHash
    app.verificationTokenRepository.markAsUsed =
      markAsUsedMock as unknown as typeof app.verificationTokenRepository.markAsUsed
    app.userRepository.updatePassword =
      updatePasswordMock as unknown as typeof app.userRepository.updatePassword

    const response = await injectResetPassword()

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid token',
    })
    assert.strictEqual(findByTokenHashMock.mock.callCount(), 1)
    assert.strictEqual(findByTokenHashMock.mock.calls[0].arguments[0], tokenHash)
    assert.strictEqual(markAsUsedMock.mock.callCount(), 0)
    assert.strictEqual(updatePasswordMock.mock.callCount(), 0)
  })

  test('should return bad request when token was already used', async () => {
    const findByTokenHashMock = mock.fn(async (_tokenHash: string) => {
      return createVerificationRecord({
        usedAt: new Date(),
      })
    })
    const markAsUsedMock = mock.fn(async (_id: string) => undefined)
    const updatePasswordMock = mock.fn(async (_id: string, _passwordHash: string) => undefined)

    app.verificationTokenRepository.findByTokenHash =
      findByTokenHashMock as typeof app.verificationTokenRepository.findByTokenHash
    app.verificationTokenRepository.markAsUsed =
      markAsUsedMock as unknown as typeof app.verificationTokenRepository.markAsUsed
    app.userRepository.updatePassword =
      updatePasswordMock as unknown as typeof app.userRepository.updatePassword

    const response = await injectResetPassword()

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Token already used',
    })
    assert.strictEqual(findByTokenHashMock.mock.callCount(), 1)
    assert.strictEqual(findByTokenHashMock.mock.calls[0].arguments[0], tokenHash)
    assert.strictEqual(markAsUsedMock.mock.callCount(), 0)
    assert.strictEqual(updatePasswordMock.mock.callCount(), 0)
  })

  test('should return bad request when token is expired', async () => {
    const findByTokenHashMock = mock.fn(async (_tokenHash: string) => {
      return createVerificationRecord({
        expiresAt: new Date(Date.now() - 60 * 1000),
      })
    })
    const markAsUsedMock = mock.fn(async (_id: string) => undefined)
    const updatePasswordMock = mock.fn(async (_id: string, _passwordHash: string) => undefined)

    app.verificationTokenRepository.findByTokenHash =
      findByTokenHashMock as typeof app.verificationTokenRepository.findByTokenHash
    app.verificationTokenRepository.markAsUsed =
      markAsUsedMock as unknown as typeof app.verificationTokenRepository.markAsUsed
    app.userRepository.updatePassword =
      updatePasswordMock as unknown as typeof app.userRepository.updatePassword

    const response = await injectResetPassword()

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Token expired',
    })
    assert.strictEqual(findByTokenHashMock.mock.callCount(), 1)
    assert.strictEqual(findByTokenHashMock.mock.calls[0].arguments[0], tokenHash)
    assert.strictEqual(markAsUsedMock.mock.callCount(), 0)
    assert.strictEqual(updatePasswordMock.mock.callCount(), 0)
  })

  test('should return bad request when token type is invalid', async () => {
    const findByTokenHashMock = mock.fn(async (_tokenHash: string) => {
      return createVerificationRecord({
        type: 'email_verification',
      })
    })
    const markAsUsedMock = mock.fn(async (_id: string) => undefined)
    const updatePasswordMock = mock.fn(async (_id: string, _passwordHash: string) => undefined)

    app.verificationTokenRepository.findByTokenHash =
      findByTokenHashMock as typeof app.verificationTokenRepository.findByTokenHash
    app.verificationTokenRepository.markAsUsed =
      markAsUsedMock as unknown as typeof app.verificationTokenRepository.markAsUsed
    app.userRepository.updatePassword =
      updatePasswordMock as unknown as typeof app.userRepository.updatePassword

    const response = await injectResetPassword()

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid token type',
    })
    assert.strictEqual(findByTokenHashMock.mock.callCount(), 1)
    assert.strictEqual(findByTokenHashMock.mock.calls[0].arguments[0], tokenHash)
    assert.strictEqual(markAsUsedMock.mock.callCount(), 0)
    assert.strictEqual(updatePasswordMock.mock.callCount(), 0)
  })

  test('should mark token as used and update password on success', async () => {
    const findByTokenHashMock = mock.fn(async (_tokenHash: string) => {
      return createVerificationRecord()
    })
    const markAsUsedMock = mock.fn(async (_id: string) => undefined)
    const updatePasswordMock = mock.fn(async (_id: string, _passwordHash: string) => undefined)

    app.verificationTokenRepository.findByTokenHash =
      findByTokenHashMock as typeof app.verificationTokenRepository.findByTokenHash
    app.verificationTokenRepository.markAsUsed =
      markAsUsedMock as unknown as typeof app.verificationTokenRepository.markAsUsed
    app.userRepository.updatePassword =
      updatePasswordMock as unknown as typeof app.userRepository.updatePassword

    const response = await injectResetPassword()

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      message: successMessage,
    })
    assert.strictEqual(findByTokenHashMock.mock.callCount(), 1)
    assert.strictEqual(findByTokenHashMock.mock.calls[0].arguments[0], tokenHash)
    assert.strictEqual(markAsUsedMock.mock.callCount(), 1)
    assert.strictEqual(markAsUsedMock.mock.calls[0].arguments[0], verificationRecordId)
    assert.strictEqual(updatePasswordMock.mock.callCount(), 1)
    assert.strictEqual(updatePasswordMock.mock.calls[0].arguments[0], userId)
    assert.notStrictEqual(updatePasswordMock.mock.calls[0].arguments[1], newPassword)
    assert.ok(verifyPassword(newPassword, updatePasswordMock.mock.calls[0].arguments[1]))
  })
})
