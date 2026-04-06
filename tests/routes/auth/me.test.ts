import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../../helper.ts'

const userId = 'user-1'
const email = 'test@example.com'

function createCurrentUserFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    email,
    name: 'Test User',
    avatarUrl: null,
    emailVerifiedAt: new Date(),
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('GET /auth/me', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function injectMe(headers?: Record<string, string>) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers,
    })
  }

  test('should return unauthorized when access token is missing', async () => {
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    app.userRepository.findById = findByIdMock

    const response = await injectMe()

    assert.strictEqual(response.statusCode, 401)
    assert.strictEqual(response.json().error, 'Unauthorized')
    assert.strictEqual(findByIdMock.mock.callCount(), 0)
  })

  test('should return not found when authenticated user does not exist', async () => {
    const { accessToken } = app.tokenService.issueTokenPair({
      user: {
        id: userId,
        email,
        tokenVersion: 1,
      },
      family: 'family-uuid-123',
    })
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    app.userRepository.findById = findByIdMock

    const response = await injectMe({
      authorization: `Bearer ${accessToken}`,
    })
    console.log(response.json())

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
    })
    assert.strictEqual(findByIdMock.mock.callCount(), 1)
    assert.strictEqual(findByIdMock.mock.calls[0].arguments[0], userId)
  })

  test('should return current user when access token is valid', async () => {
    const { accessToken } = app.tokenService.issueTokenPair({
      user: {
        id: userId,
        email,
        tokenVersion: 1,
      },
      family: 'family-uuid-123',
    })
    const currentUser = createCurrentUserFixture()
    const findByIdMock = mock.fn(async (_id: string) => currentUser)
    app.userRepository.findById = findByIdMock

    const response = await injectMe({
      authorization: `Bearer ${accessToken}`,
    })
    console.log(response.json())

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
      },
    })
    assert.strictEqual(findByIdMock.mock.callCount(), 1)
    assert.strictEqual(findByIdMock.mock.calls[0].arguments[0], userId)
  })
})
