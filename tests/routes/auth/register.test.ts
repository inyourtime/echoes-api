import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../../helper.ts'

describe('POST /auth/register', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('should throw conflict error when user already exists', async () => {
    const findByEmailMock = mock.fn(async () => ({
      id: '1',
      email: 'test@example.com',
      emailVerifiedAt: new Date(),
      passwordHash: 'password',
      name: 'Test User',
      avatarUrl: null,
      isActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    app.userRepository.findByEmail = findByEmailMock

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      },
    })

    assert.strictEqual(response.statusCode, 409)
    assert.strictEqual(response.json().message, 'User already exists')
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
  })

  test('should create user successfully', async () => {
    const findByEmailMock = mock.fn(async () => undefined)
    app.userRepository.findByEmail = findByEmailMock

    const createUserMock = mock.fn(async () => ({
      id: '1',
      email: 'test@example.com',
      emailVerifiedAt: new Date(),
      passwordHash: 'password',
      name: 'Test User',
      avatarUrl: null,
      isActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    app.userRepository.create = createUserMock

    const createVerificationTokenMock = mock.fn(async () => ({
      id: '1',
      userId: '1',
      type: 'email_verification' as const,
      tokenHash: 'tokenHash',
      expiresAt: new Date(),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    app.verificationTokenRepository.create = createVerificationTokenMock

    const sendVerificationMock = mock.fn(async (_email: string, _verificationUrl: string) => {})
    app.mailerService.sendVerification = sendVerificationMock

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      },
    })

    // assert.strictEqual(response.statusCode, 201)
    assert.strictEqual(
      response.json().message,
      'Registration successful. Please check your email to verify your account.',
    )
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(createUserMock.mock.callCount(), 1)
    assert.strictEqual(sendVerificationMock.mock.callCount(), 1)
    assert.strictEqual(sendVerificationMock.mock.calls[0].arguments[0], 'test@example.com')
  })
})
