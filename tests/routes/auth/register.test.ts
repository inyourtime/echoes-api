import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { verifyPassword } from '../../../src/utils/hash.ts'
import { buildTestApp } from '../../helper.ts'

const userId = '1'
const registerPayload = {
  email: 'TEST@example.com',
  password: 'password',
  name: 'Test User',
}
const normalizedEmail = 'test@example.com'
const successMessage = 'Registration successful. Please check your email to verify your account.'

type CreateUserInput = {
  email: string
  passwordHash: string
  name: string
}

type CreateVerificationTokenInput = {
  userId: string
  type: 'email_verification'
  tokenHash: string
  expiresAt: Date
}

function createUserFixture() {
  return {
    id: userId,
    email: normalizedEmail,
    emailVerifiedAt: new Date(),
    passwordHash: 'password',
    name: registerPayload.name,
    avatarUrl: null,
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('POST /auth/register', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function injectRegister() {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: registerPayload,
    })
  }

  test('should return conflict and skip side effects when user already exists', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture()
    })
    const createUserMock = mock.fn(async () => {
      throw new Error('create should not be called')
    })
    const createVerificationTokenMock = mock.fn(async () => {
      throw new Error('verification token create should not be called')
    })
    const sendVerificationMock = mock.fn(
      async (_email: string, _verificationUrl: string) => undefined,
    )

    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.verificationTokenRepository.create = createVerificationTokenMock
    app.mailerService.sendVerification = sendVerificationMock

    const response = await injectRegister()

    assert.strictEqual(response.statusCode, 409)
    assert.deepStrictEqual(response.json(), {
      statusCode: 409,
      error: 'Conflict',
      message: 'User already exists',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(createUserMock.mock.callCount(), 0)
    assert.strictEqual(createVerificationTokenMock.mock.callCount(), 0)
    assert.strictEqual(sendVerificationMock.mock.callCount(), 0)
  })

  test('should create user, issue verification token, and send verification email', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return undefined
    })
    app.userRepository.findByEmail = findByEmailMock

    const createUserMock = mock.fn(async (_input: CreateUserInput) => {
      return createUserFixture()
    })
    app.userRepository.create = createUserMock

    const now = Date.now()
    const createVerificationTokenMock = mock.fn(async (_input: CreateVerificationTokenInput) => {
      return {
        id: '1',
        userId,
        type: 'email_verification' as const,
        tokenHash: 'tokenHash',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    app.verificationTokenRepository.create = createVerificationTokenMock

    const sendVerificationMock = mock.fn(async (_email: string, _verificationUrl: string) => {})
    app.mailerService.sendVerification = sendVerificationMock

    const response = await injectRegister()

    assert.strictEqual(response.statusCode, 201)
    assert.deepStrictEqual(response.json(), {
      user: {
        id: userId,
        email: normalizedEmail,
        name: registerPayload.name,
      },
      message: successMessage,
    })

    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)

    assert.strictEqual(createUserMock.mock.callCount(), 1)
    const createUserArgs = createUserMock.mock.calls[0]?.arguments
    assert.deepStrictEqual(createUserArgs[0], {
      email: normalizedEmail,
      name: registerPayload.name,
      passwordHash: createUserArgs[0].passwordHash,
    })
    assert.notStrictEqual(createUserArgs[0].passwordHash, registerPayload.password)
    assert.ok(verifyPassword(registerPayload.password, createUserArgs[0].passwordHash))

    assert.strictEqual(createVerificationTokenMock.mock.callCount(), 1)
    const createVerificationTokenArgs = createVerificationTokenMock.mock.calls[0].arguments
    assert.strictEqual(createVerificationTokenArgs[0].userId, userId)
    assert.strictEqual(createVerificationTokenArgs[0].type, 'email_verification')
    assert.match(createVerificationTokenArgs[0].tokenHash, /^[0-9a-f]{64}$/)
    assert.ok(createVerificationTokenArgs[0].expiresAt instanceof Date)
    assert.ok(createVerificationTokenArgs[0].expiresAt.getTime() > now)

    assert.strictEqual(sendVerificationMock.mock.callCount(), 1)
    const sendVerificationArgs = sendVerificationMock.mock.calls[0].arguments
    assert.strictEqual(sendVerificationArgs[0], normalizedEmail)
    assert.match(
      sendVerificationArgs[1],
      /^http:\/\/localhost:3000\/verify-email\?token=[0-9a-f]{64}$/,
    )
  })
})
