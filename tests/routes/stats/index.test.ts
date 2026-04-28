import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, injectWithAccessToken } from '../../helper.ts'

const user = {
  email: 'stats-user@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  tokenVersion: 1,
}

const tagId = '22222222-2222-4222-8222-222222222222'

describe('stats routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('GET /stats/top-artists should return unauthorized when access token is missing', async () => {
    const getTopArtistsMock = mock.fn(async (_userId: string, _limit?: number) => [])
    app.statsRepository.getTopArtists = getTopArtistsMock

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/stats/top-artists',
    })

    assert.strictEqual(response.statusCode, 401)
    assert.strictEqual(response.json().error, 'Unauthorized')
    assert.strictEqual(getTopArtistsMock.mock.callCount(), 0)
  })

  test('GET /stats/top-artists should use default limit', async () => {
    const artists = [
      { artist: 'The Midnight', count: 3 },
      { artist: 'M83', count: 2 },
    ]
    const getTopArtistsMock = mock.fn(async (_userId: string, _limit?: number) => artists)
    app.statsRepository.getTopArtists = getTopArtistsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/top-artists',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), { artists })
    assert.deepStrictEqual(getTopArtistsMock.mock.calls[0].arguments, [user.id, 10])
  })

  test('GET /stats/top-artists should pass query limit to repository', async () => {
    const getTopArtistsMock = mock.fn(async (_userId: string, _limit?: number) => [])
    app.statsRepository.getTopArtists = getTopArtistsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/top-artists?limit=3',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), { artists: [] })
    assert.deepStrictEqual(getTopArtistsMock.mock.calls[0].arguments, [user.id, 3])
  })

  test('GET /stats/monthly-activity should use default months', async () => {
    const activity = [
      { month: '2026-03', count: 4 },
      { month: '2026-04', count: 6 },
    ]
    const getMonthlyActivityMock = mock.fn(async (_userId: string, _months?: number) => activity)
    app.statsRepository.getMonthlyActivity = getMonthlyActivityMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/monthly-activity',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), { activity })
    assert.deepStrictEqual(getMonthlyActivityMock.mock.calls[0].arguments, [user.id, 12])
  })

  test('GET /stats/monthly-activity should pass query months to repository', async () => {
    const getMonthlyActivityMock = mock.fn(async (_userId: string, _months?: number) => [])
    app.statsRepository.getMonthlyActivity = getMonthlyActivityMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/monthly-activity?months=6',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), { activity: [] })
    assert.deepStrictEqual(getMonthlyActivityMock.mock.calls[0].arguments, [user.id, 6])
  })

  test('GET /stats/tag-distribution should return distribution and total tagged count', async () => {
    const distribution = [
      {
        color: '#ff5500',
        count: 3,
        name: 'Favorites',
        percentage: 75,
        tagId,
      },
      {
        color: '#0088ff',
        count: 1,
        name: 'Road trip',
        percentage: 25,
        tagId: '33333333-3333-4333-8333-333333333333',
      },
    ]
    const getTagDistributionMock = mock.fn(async (_userId: string) => distribution)
    app.statsRepository.getTagDistribution = getTagDistributionMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/tag-distribution',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      distribution,
      totalTagged: 4,
    })
    assert.deepStrictEqual(getTagDistributionMock.mock.calls[0].arguments, [user.id])
  })

  test('GET /stats/tag-distribution should return zero total for empty distribution', async () => {
    const getTagDistributionMock = mock.fn(async (_userId: string) => [])
    app.statsRepository.getTagDistribution = getTagDistributionMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/tag-distribution',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      distribution: [],
      totalTagged: 0,
    })
  })

  test('GET /stats/overview should return dashboard overview stats', async () => {
    const overview = {
      thisMonthCount: 5,
      totalArtists: 8,
      totalTracks: 12,
      uniqueTagsUsed: 4,
    }
    const getOverviewMock = mock.fn(async (_userId: string) => overview)
    app.statsRepository.getOverview = getOverviewMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/stats/overview',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), overview)
    assert.deepStrictEqual(getOverviewMock.mock.calls[0].arguments, [user.id])
  })
})
