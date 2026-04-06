import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { User } from '../../../src/db/schema.ts'
import type { IssueTokenPairOptions, TokenPair } from '../../../src/plugins/token.ts'
import { hashPassword } from '../../../src/utils/hash.ts'
import { buildTestApp } from '../../helper.ts'

const userId = '1'
const loginPayload = {
  email: 'TEST@example.com',
  password: 'password123',
}
const normalizedEmail = 'test@example.com'
const userAgent = 'echoes-login-test'

function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: normalizedEmail,
    emailVerifiedAt: new Date(),
    passwordHash: hashPassword(loginPayload.password),
    name: 'Test User',
    avatarUrl: null,
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /auth/login', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function injectLogin() {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'user-agent': userAgent,
      },
      payload: loginPayload,
    })
  }

  test('should return unauthorized when user does not exist', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const createOrUpdateMock = mock.fn(async () => undefined)
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('issueTokenPair should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.tokenService.issueTokenPair = issueTokenPairMock

    const response = await injectLogin()

    assert.strictEqual(response.statusCode, 401)
    assert.deepStrictEqual(response.json(), {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email or password is incorrect',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('should return forbidden when email is not verified', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture({
        emailVerifiedAt: null,
      })
    })
    const createOrUpdateMock = mock.fn(async () => undefined)
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('issueTokenPair should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.tokenService.issueTokenPair = issueTokenPairMock

    const response = await injectLogin()

    assert.strictEqual(response.statusCode, 403)
    assert.deepStrictEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Please verify your email before logging in',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('should return unauthorized when user has no password hash', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture({
        passwordHash: null,
      })
    })
    const createOrUpdateMock = mock.fn(async () => undefined)
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('issueTokenPair should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.tokenService.issueTokenPair = issueTokenPairMock

    const response = await injectLogin()

    assert.strictEqual(response.statusCode, 401)
    assert.deepStrictEqual(response.json(), {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email or password is incorrect',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('should return unauthorized when password is incorrect', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture({
        passwordHash: hashPassword('different-password'),
      })
    })
    const createOrUpdateMock = mock.fn(async () => undefined)
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('issueTokenPair should not be called')
    })

    app.userRepository.findByEmail = findByEmailMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.tokenService.issueTokenPair = issueTokenPairMock

    const response = await injectLogin()

    assert.strictEqual(response.statusCode, 401)
    assert.deepStrictEqual(response.json(), {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email or password is incorrect',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('should return access token, persist refresh token, and set cookie on successful login', async () => {
    const findByEmailMock = mock.fn(async (_email: string) => {
      return createUserFixture()
    })
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      return {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenHash: 'token-hash',
      }
    })
    const createOrUpdateMock = mock.fn(async (_input) => undefined)

    app.userRepository.findByEmail = findByEmailMock
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock

    const now = Date.now()
    const response = await injectLogin()

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      accessToken: 'access-token',
    })
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], normalizedEmail)

    assert.strictEqual(issueTokenPairMock.mock.callCount(), 1)
    const issueTokenPairArgs = issueTokenPairMock.mock.calls[0].arguments
    assert.strictEqual(issueTokenPairArgs[0].user.id, userId)
    assert.strictEqual(issueTokenPairArgs[0].user.email, normalizedEmail)
    assert.strictEqual(issueTokenPairArgs[0].user.tokenVersion, 1)
    assert.match(
      issueTokenPairArgs[0].family,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    assert.strictEqual(createOrUpdateMock.mock.callCount(), 1)
    const createOrUpdateArgs = createOrUpdateMock.mock.calls[0].arguments
    assert.strictEqual(createOrUpdateArgs[0].userId, userId)
    assert.strictEqual(createOrUpdateArgs[0].family, issueTokenPairArgs[0].family)
    assert.strictEqual(createOrUpdateArgs[0].tokenHash, 'token-hash')
    assert.strictEqual(createOrUpdateArgs[0].tokenVersion, 1)
    assert.strictEqual(createOrUpdateArgs[0].userAgent, userAgent)
    assert.strictEqual(createOrUpdateArgs[0].ipAddress, '127.0.0.1')
    assert.ok(createOrUpdateArgs[0].lastUsedAt instanceof Date)
    assert.ok(createOrUpdateArgs[0].expiresAt instanceof Date)
    assert.ok(createOrUpdateArgs[0].expiresAt.getTime() > now)

    const setCookieHeader = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'][0]
      : response.headers['set-cookie'] || ''
    assert.match(setCookieHeader, /refreshToken=refresh-token/)
    assert.match(setCookieHeader, /HttpOnly/)
    assert.match(setCookieHeader, /Path=\//)
    assert.match(setCookieHeader, /SameSite=Lax/)
  })
})
