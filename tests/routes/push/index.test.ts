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
const onThisDayMemories = [
  {
    listenedAt: new Date('2025-04-15T08:30:00.000Z'),
    track: {
      artist: 'The Midnight',
      title: 'Days of Thunder',
    },
    userTrackId: 'user-track-memory-1',
    yearsAgo: 1,
  },
  {
    listenedAt: new Date('2024-04-15T09:00:00.000Z'),
    track: {
      artist: 'M83',
      title: 'Midnight City',
    },
    userTrackId: 'user-track-memory-2',
    yearsAgo: 2,
  },
]

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

  test('POST /push/on-this-day should return no_memories when no matching memories exist', async () => {
    const findOnThisDayMemoriesMock = mock.fn(async (_input) => [])
    const findByUserIdMock = mock.fn(async (_userId: string) => [registeredPushToken])

    app.userTrackRepository.findOnThisDayMemories = findOnThisDayMemoriesMock
    app.pushTokenRepository.findByUserId = findByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          date: '2026-04-15',
        },
        url: '/api/v1/push/on-this-day',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      date: '2026-04-15',
      failureCount: 0,
      invalidatedCount: 0,
      memoryCount: 0,
      message: 'No On This Day memories found.',
      selectedMemory: null,
      sent: false,
      status: 'no_memories',
      successCount: 0,
    })
    assert.strictEqual(findOnThisDayMemoriesMock.mock.callCount(), 1)
    assert.deepStrictEqual(findOnThisDayMemoriesMock.mock.calls[0].arguments[0], {
      targetDate: new Date('2026-04-15T00:00:00.000Z'),
      userId: user.id,
    })
    assert.strictEqual(findByUserIdMock.mock.callCount(), 0)
  })

  test('POST /push/on-this-day should return no_push_tokens when memories exist but no device is registered', async () => {
    app.firebaseMessagingService.isConfigured = () => true
    const findOnThisDayMemoriesMock = mock.fn(async (_input) => onThisDayMemories)
    const findByUserIdMock = mock.fn(async (_userId: string) => [])
    const sendToTokensMock = mock.fn(async (_input) => ({
      failureCount: 0,
      invalidTokens: [],
      responses: [],
      successCount: 0,
    }))

    app.userTrackRepository.findOnThisDayMemories = findOnThisDayMemoriesMock
    app.pushTokenRepository.findByUserId = findByUserIdMock
    app.firebaseMessagingService.sendToTokens = sendToTokensMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          date: '2026-04-15',
        },
        url: '/api/v1/push/on-this-day',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      date: '2026-04-15',
      failureCount: 0,
      invalidatedCount: 0,
      memoryCount: 2,
      message: 'No registered push tokens for On This Day notification.',
      selectedMemory: {
        listenedAt: onThisDayMemories[0].listenedAt.toISOString(),
        track: onThisDayMemories[0].track,
        userTrackId: onThisDayMemories[0].userTrackId,
        yearsAgo: onThisDayMemories[0].yearsAgo,
      },
      sent: false,
      status: 'no_push_tokens',
      successCount: 0,
    })
    assert.strictEqual(sendToTokensMock.mock.callCount(), 0)
  })

  test('POST /push/on-this-day should send a memory notification and invalidate bad tokens', async () => {
    app.firebaseMessagingService.isConfigured = () => true
    const findOnThisDayMemoriesMock = mock.fn(async (_input) => onThisDayMemories)
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

    app.userTrackRepository.findOnThisDayMemories = findOnThisDayMemoriesMock
    app.pushTokenRepository.findByUserId = findByUserIdMock
    app.pushTokenRepository.deleteByTokens = deleteByTokensMock
    app.firebaseMessagingService.sendToTokens = sendToTokensMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          date: '2026-04-15',
          url: '/timeline/:id?source=on-this-day',
        },
        url: '/api/v1/push/on-this-day',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      date: '2026-04-15',
      failureCount: 0,
      invalidatedCount: 1,
      memoryCount: 2,
      message: 'On This Day notification processed.',
      selectedMemory: {
        listenedAt: onThisDayMemories[0].listenedAt.toISOString(),
        track: onThisDayMemories[0].track,
        userTrackId: onThisDayMemories[0].userTrackId,
        yearsAgo: onThisDayMemories[0].yearsAgo,
      },
      sent: true,
      status: 'processed',
      successCount: 1,
    })
    assert.strictEqual(findOnThisDayMemoriesMock.mock.callCount(), 1)
    assert.strictEqual(findByUserIdMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByUserIdMock.mock.calls[0].arguments, [user.id])
    assert.strictEqual(sendToTokensMock.mock.callCount(), 1)
    assert.deepStrictEqual(sendToTokensMock.mock.calls[0].arguments[0], {
      body: 'วันนี้เมื่อ 1 ปีก่อน เพลง Days of Thunder - The Midnight เคยเข้ามาอยู่ในความทรงจำของคุณ ยังมีอีก 1 ความทรงจำจากวันนี้ รอให้คุณกลับไปฟังอีกครั้ง',
      data: {
        monthDay: '04-15',
        type: 'on_this_day',
        url: `/timeline/${onThisDayMemories[0].userTrackId}?source=on-this-day`,
        userTrackId: onThisDayMemories[0].userTrackId,
      },
      title: 'วันนี้ในวันนั้น',
      tokens: [registeredPushToken.token],
      url: `/timeline/${onThisDayMemories[0].userTrackId}?source=on-this-day`,
    })
    assert.strictEqual(deleteByTokensMock.mock.callCount(), 1)
    assert.deepStrictEqual(deleteByTokensMock.mock.calls[0].arguments[0], [
      registeredPushToken.token,
    ])
  })

  test('POST /push/on-this-day should default to timeline detail path for the selected memory', async () => {
    app.firebaseMessagingService.isConfigured = () => true
    const findOnThisDayMemoriesMock = mock.fn(async (_input) => onThisDayMemories)
    const findByUserIdMock = mock.fn(async (_userId: string) => [registeredPushToken])
    const sendToTokensMock = mock.fn(async (_input) => ({
      failureCount: 0,
      invalidTokens: [],
      responses: [
        {
          success: true,
          token: registeredPushToken.token,
        },
      ],
      successCount: 1,
    }))

    app.userTrackRepository.findOnThisDayMemories = findOnThisDayMemoriesMock
    app.pushTokenRepository.findByUserId = findByUserIdMock
    app.firebaseMessagingService.sendToTokens = sendToTokensMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          date: '2026-04-15',
        },
        url: '/api/v1/push/on-this-day',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(sendToTokensMock.mock.callCount(), 1)
    assert.deepStrictEqual(sendToTokensMock.mock.calls[0].arguments[0], {
      body: 'วันนี้เมื่อ 1 ปีก่อน เพลง Days of Thunder - The Midnight เคยเข้ามาอยู่ในความทรงจำของคุณ ยังมีอีก 1 ความทรงจำจากวันนี้ รอให้คุณกลับไปฟังอีกครั้ง',
      data: {
        monthDay: '04-15',
        type: 'on_this_day',
        url: `/timeline/${onThisDayMemories[0].userTrackId}`,
        userTrackId: onThisDayMemories[0].userTrackId,
      },
      title: 'วันนี้ในวันนั้น',
      tokens: [registeredPushToken.token],
      url: `/timeline/${onThisDayMemories[0].userTrackId}`,
    })
  })
})
