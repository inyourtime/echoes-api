import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, injectWithAccessToken } from '../../helper.ts'

const user = {
  email: 'push-user@example.com',
  id: 'user-push-1',
  tokenVersion: 1,
}
const registeredPushToken = {
  createdAt: new Date('2026-04-12T12:00:00.000Z'),
  id: 'push-token-1',
  lastRegisteredAt: new Date('2026-04-12T12:00:00.000Z'),
  platform: 'web' as const,
  token: 'device-token-1',
  updatedAt: new Date('2026-04-12T12:00:00.000Z'),
  userAgent: 'echoes-tests',
  userId: user.id,
}

describe('push routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('POST /push/tokens should register token for authenticated user', async () => {
    const createOrUpdateMock = mock.fn(async (_input) => registeredPushToken)
    app.pushTokenRepository.createOrUpdate = createOrUpdateMock

    const response = await injectWithAccessToken(
      app,
      {
        headers: {
          'user-agent': 'echoes-tests',
        },
        method: 'POST',
        payload: {
          platform: 'web',
          token: ` ${registeredPushToken.token} `,
        },
        url: '/api/v1/push/tokens',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 201)
    assert.deepStrictEqual(response.json(), {
      message: 'Push token registered successfully.',
      pushToken: {
        createdAt: registeredPushToken.createdAt.toISOString(),
        id: registeredPushToken.id,
        lastRegisteredAt: registeredPushToken.lastRegisteredAt.toISOString(),
        platform: registeredPushToken.platform,
        updatedAt: registeredPushToken.updatedAt.toISOString(),
        userAgent: registeredPushToken.userAgent,
        userId: registeredPushToken.userId,
      },
    })
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 1)
    assert.deepStrictEqual(createOrUpdateMock.mock.calls[0].arguments[0], {
      platform: 'web',
      token: registeredPushToken.token,
      userAgent: 'echoes-tests',
      userId: user.id,
    })
  })

  test('DELETE /push/tokens should remove token for authenticated user', async () => {
    const deleteMock = mock.fn(async (_userId: string, _token: string) => [])
    app.pushTokenRepository.deleteByUserIdAndToken = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        payload: {
          token: ` ${registeredPushToken.token} `,
        },
        url: '/api/v1/push/tokens',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      message: 'Push token removed successfully.',
    })
    assert.strictEqual(deleteMock.mock.callCount(), 1)
    assert.deepStrictEqual(deleteMock.mock.calls[0].arguments, [user.id, registeredPushToken.token])
  })

  test('POST /push/test should return 503 when Firebase messaging is not configured', async () => {
    app.firebaseMessagingService.isConfigured = () => false

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {},
        url: '/api/v1/push/test',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 503)
    assert.deepStrictEqual(response.json(), {
      error: 'Service Unavailable',
      message: 'Firebase messaging is not configured',
      statusCode: 503,
    })
  })

  test('POST /push/test should return 400 when user has no registered push tokens', async () => {
    app.firebaseMessagingService.isConfigured = () => true
    const findByUserIdMock = mock.fn(async (_userId: string) => [])
    app.pushTokenRepository.findByUserId = findByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {},
        url: '/api/v1/push/test',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      error: 'Bad Request',
      message: 'No push tokens registered for this user',
      statusCode: 400,
    })
    assert.strictEqual(findByUserIdMock.mock.callCount(), 1)
  })

  test('POST /push/test should send notification and delete invalid tokens', async () => {
    app.firebaseMessagingService.isConfigured = () => true
    const findByUserIdMock = mock.fn(async (_userId: string) => [registeredPushToken])
    const sendToTokensMock = mock.fn(async (_input) => ({
      failureCount: 0,
      invalidTokens: [registeredPushToken.token],
      responses: [
        {
          success: false,
          token: registeredPushToken.token,
        },
      ],
      successCount: 1,
    }))
    const deleteByTokensMock = mock.fn(async (_tokens: string[]) => [])

    app.pushTokenRepository.findByUserId = findByUserIdMock
    app.pushTokenRepository.deleteByTokens = deleteByTokensMock
    app.firebaseMessagingService.sendToTokens = sendToTokensMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          body: 'ทดสอบการแจ้งเตือน',
          title: 'Echoes test',
          url: '/timeline',
        },
        url: '/api/v1/push/test',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      failureCount: 0,
      invalidatedCount: 1,
      message: 'Test push notification processed.',
      successCount: 1,
    })
    assert.strictEqual(findByUserIdMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByUserIdMock.mock.calls[0].arguments, [user.id])
    assert.strictEqual(sendToTokensMock.mock.callCount(), 1)
    assert.deepStrictEqual(sendToTokensMock.mock.calls[0].arguments[0], {
      body: 'ทดสอบการแจ้งเตือน',
      data: {
        url: '/timeline',
      },
      title: 'Echoes test',
      tokens: [registeredPushToken.token],
      url: '/timeline',
    })
    assert.strictEqual(deleteByTokensMock.mock.callCount(), 1)
    assert.deepStrictEqual(deleteByTokensMock.mock.calls[0].arguments[0], [
      registeredPushToken.token,
    ])
  })
})
