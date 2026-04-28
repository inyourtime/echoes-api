import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, injectWithAccessToken } from '../../helper.ts'

const user = {
  email: 'user-tracks-user@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  tokenVersion: 1,
}

const otherUserId = '22222222-2222-4222-8222-222222222222'
const trackId = '33333333-3333-4333-8333-333333333333'
const userTrackId = '44444444-4444-4444-8444-444444444444'
const tagId = '55555555-5555-4555-8555-555555555555'

const listenedAt = new Date('2026-04-12T12:00:00.000Z')
const createdAt = new Date('2026-04-12T13:00:00.000Z')
const updatedAt = new Date('2026-04-12T14:00:00.000Z')

type TrackFixture = {
  id: string
  createdAt: Date
  updatedAt: Date
  source: 'spotify' | 'manual' | 'apple-music'
  externalId: string | null
  title: string
  titleNormalized: string
  artistNormalized: string
  artist: string
  search: string | null
}

type TagFixture = {
  id: string
  userId: string
  name: string
  color: string | null
  createdAt: Date
}

type UserTrackFixture = {
  id: string
  userId: string
  trackId: string
  note: string | null
  youtubeUrl: string | null
  spotifyUrl: string | null
  appleMusicUrl: string | null
  otherUrl: string | null
  listenedAt: Date
  createdAt: Date
  updatedAt: Date
  track: TrackFixture
  tags: TagFixture[]
}

function createTrackFixture(overrides: Partial<TrackFixture> = {}): TrackFixture {
  return {
    artist: 'The Midnight',
    artistNormalized: 'the midnight',
    createdAt,
    externalId: null,
    id: trackId,
    search: null,
    source: 'manual',
    title: 'Days of Thunder',
    titleNormalized: 'days of thunder',
    updatedAt,
    ...overrides,
  }
}

function createTagFixture(overrides: Partial<TagFixture> = {}): TagFixture {
  return {
    color: '#ff5500',
    createdAt,
    id: tagId,
    name: 'Favorites',
    userId: user.id,
    ...overrides,
  }
}

function createUserTrackFixture(
  overrides: Partial<Omit<UserTrackFixture, 'track' | 'tags'>> & {
    track?: Partial<TrackFixture>
    tags?: TagFixture[]
  } = {},
): UserTrackFixture {
  const { track, tags, ...userTrackOverrides } = overrides

  return {
    appleMusicUrl: null,
    createdAt,
    id: userTrackId,
    listenedAt,
    note: 'Night drive',
    otherUrl: null,
    spotifyUrl: null,
    tags: tags ?? [createTagFixture()],
    track: createTrackFixture(track),
    trackId,
    updatedAt,
    userId: user.id,
    youtubeUrl: 'https://www.youtube.com/watch?v=test',
    ...userTrackOverrides,
  }
}

function serializeUserTrack(userTrack: UserTrackFixture) {
  return {
    createdAt: userTrack.createdAt.toISOString(),
    id: userTrack.id,
    listenedAt: userTrack.listenedAt.toISOString(),
    note: userTrack.note,
    tags: userTrack.tags.map((tag) => ({
      ...tag,
      createdAt: tag.createdAt.toISOString(),
    })),
    track: {
      artist: userTrack.track.artist,
      externalId: userTrack.track.externalId,
      id: userTrack.track.id,
      source: userTrack.track.source,
      title: userTrack.track.title,
    },
    trackId: userTrack.trackId,
    updatedAt: userTrack.updatedAt.toISOString(),
    userId: userTrack.userId,
    youtubeUrl: userTrack.youtubeUrl,
  }
}

describe('user-tracks routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('GET /user-tracks should return unauthorized when access token is missing', async () => {
    const findManyByUserIdMock = mock.fn(async (_input) => ({ items: [], nextCursor: null }))
    app.userTrackRepository.findManyByUserId = findManyByUserIdMock

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/user-tracks',
    })

    assert.strictEqual(response.statusCode, 401)
    assert.strictEqual(response.json().error, 'Unauthorized')
    assert.strictEqual(findManyByUserIdMock.mock.callCount(), 0)
  })

  test('GET /user-tracks should list user tracks with query defaults', async () => {
    const userTrack = createUserTrackFixture()
    const findManyByUserIdMock = mock.fn(async (_input) => ({
      items: [userTrack],
      nextCursor: 'next-cursor',
    }))
    app.userTrackRepository.findManyByUserId = findManyByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/user-tracks',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      meta: {
        limit: 20,
        nextCursor: 'next-cursor',
      },
      userTracks: [serializeUserTrack(userTrack)],
    })
    assert.deepStrictEqual(findManyByUserIdMock.mock.calls[0].arguments[0], {
      limit: 20,
      order: 'desc',
      sort: 'listenedAt',
      userId: user.id,
    })
  })

  test('GET /user-tracks should pass pagination and filters to repository', async () => {
    const findManyByUserIdMock = mock.fn(async (_input) => ({ items: [], nextCursor: null }))
    app.userTrackRepository.findManyByUserId = findManyByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/user-tracks?limit=5&cursor=abc&sort=createdAt&order=asc&tagIds=${tagId}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(findManyByUserIdMock.mock.calls[0].arguments[0], {
      cursor: 'abc',
      limit: 5,
      order: 'asc',
      sort: 'createdAt',
      tagIds: [tagId],
      userId: user.id,
    })
  })

  test('POST /user-tracks/search should pass search filters to repository', async () => {
    const userTrack = createUserTrackFixture()
    const searchByUserIdMock = mock.fn(async (_input) => ({
      items: [userTrack],
      nextCursor: null,
    }))
    app.userTrackRepository.searchByUserId = searchByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          artist: 'The Midnight',
          limit: 10,
          listenedAtFrom: '2026-01-01',
          listenedAtTo: '2026-12-31',
          order: 'asc',
          search: 'days thunder',
          sort: 'createdAt',
          tagIds: [tagId],
        },
        url: '/api/v1/user-tracks/search',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      meta: {
        limit: 10,
        nextCursor: null,
      },
      userTracks: [serializeUserTrack(userTrack)],
    })
    assert.deepStrictEqual(searchByUserIdMock.mock.calls[0].arguments[0], {
      artist: 'The Midnight',
      limit: 10,
      listenedAtFrom: '2026-01-01',
      listenedAtTo: '2026-12-31',
      order: 'asc',
      search: 'days thunder',
      sort: 'createdAt',
      tagIds: [tagId],
      userId: user.id,
    })
  })

  test('GET /user-tracks/:id should return a user track owned by authenticated user', async () => {
    const userTrack = createUserTrackFixture()
    const findByIdMock = mock.fn(async (_id: string) => userTrack)
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/user-tracks/${userTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      userTrack: serializeUserTrack(userTrack),
    })
    assert.deepStrictEqual(findByIdMock.mock.calls[0].arguments, [userTrack.id])
  })

  test('GET /user-tracks/:id should return not found when user track belongs to another user', async () => {
    const userTrack = createUserTrackFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => userTrack)
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/user-tracks/${userTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
  })

  test('GET /user-tracks/:id should return not found when user track does not exist', async () => {
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/user-tracks/${userTrackId}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
    assert.deepStrictEqual(findByIdMock.mock.calls[0].arguments, [userTrackId])
  })

  test('POST /user-tracks should create a manual track when no matching track exists', async () => {
    const persistedTrack = createTrackFixture({
      id: '66666666-6666-4666-8666-666666666666',
      title: 'A+B & C',
    })
    const createdUserTrack = createUserTrackFixture({
      id: '77777777-7777-4777-8777-777777777777',
      track: {
        artist: persistedTrack.artist,
        externalId: persistedTrack.externalId,
        id: persistedTrack.id,
        source: persistedTrack.source,
        title: persistedTrack.title,
      },
      trackId: persistedTrack.id,
    })
    const findByNormalizedTitleArtistMock = mock.fn(
      async (_titleNormalized: string, _artistNormalized: string) => undefined,
    )
    const createTrackMock = mock.fn(async (_input) => persistedTrack)
    const findByUserIdAndTrackIdMock = mock.fn(
      async (_userId: string, _trackId: string) => undefined,
    )
    const createWithTagsMock = mock.fn(
      async (_input, _tagIds: string[] | undefined) => createdUserTrack,
    )
    const findByIdMock = mock.fn(async (_id: string) => createdUserTrack)
    app.trackRepository.findByNormalizedTitleArtist = findByNormalizedTitleArtistMock
    app.trackRepository.create = createTrackMock
    app.userTrackRepository.findByUserIdAndTrackId = findByUserIdAndTrackIdMock
    app.userTrackRepository.createWithTags = createWithTagsMock
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          listenedAt: listenedAt.toISOString(),
          note: createdUserTrack.note,
          tagIds: [tagId],
          track: {
            artist: persistedTrack.artist,
            title: persistedTrack.title,
          },
          youtubeUrl: createdUserTrack.youtubeUrl,
        },
        url: '/api/v1/user-tracks',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 201)
    assert.deepStrictEqual(response.json(), {
      userTrack: serializeUserTrack(createdUserTrack),
    })
    assert.deepStrictEqual(findByNormalizedTitleArtistMock.mock.calls[0].arguments, [
      'a plus b and c',
      'the midnight',
    ])
    assert.deepStrictEqual(createTrackMock.mock.calls[0].arguments[0], {
      artist: persistedTrack.artist,
      artistNormalized: 'the midnight',
      externalId: null,
      source: 'manual',
      title: persistedTrack.title,
      titleNormalized: 'a plus b and c',
    })
    assert.deepStrictEqual(findByUserIdAndTrackIdMock.mock.calls[0].arguments, [
      user.id,
      persistedTrack.id,
    ])
    assert.deepStrictEqual(createWithTagsMock.mock.calls[0].arguments, [
      {
        listenedAt,
        note: createdUserTrack.note,
        trackId: persistedTrack.id,
        userId: user.id,
        youtubeUrl: createdUserTrack.youtubeUrl,
      },
      [tagId],
    ])
    assert.deepStrictEqual(findByIdMock.mock.calls[0].arguments, [createdUserTrack.id])
  })

  test('POST /user-tracks should reuse an existing track and reject duplicates', async () => {
    const existingTrack = createTrackFixture()
    const existingUserTrack = createUserTrackFixture()
    const findByNormalizedTitleArtistMock = mock.fn(
      async (_titleNormalized: string, _artistNormalized: string) => existingTrack,
    )
    const createTrackMock = mock.fn(async (_input) => existingTrack)
    const findByUserIdAndTrackIdMock = mock.fn(
      async (_userId: string, _trackId: string) => existingUserTrack,
    )
    const createWithTagsMock = mock.fn(
      async (_input, _tagIds: string[] | undefined) => existingUserTrack,
    )
    app.trackRepository.findByNormalizedTitleArtist = findByNormalizedTitleArtistMock
    app.trackRepository.create = createTrackMock
    app.userTrackRepository.findByUserIdAndTrackId = findByUserIdAndTrackIdMock
    app.userTrackRepository.createWithTags = createWithTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          track: {
            artist: existingTrack.artist,
            title: existingTrack.title,
          },
        },
        url: '/api/v1/user-tracks',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 409)
    assert.deepStrictEqual(response.json(), {
      error: 'Conflict',
      message: 'You have already logged this track',
      statusCode: 409,
    })
    assert.strictEqual(createTrackMock.mock.callCount(), 0)
    assert.strictEqual(createWithTagsMock.mock.callCount(), 0)
  })

  test('POST /user-tracks should create an apple music sourced track when externalId is provided', async () => {
    const persistedTrack = createTrackFixture({
      externalId: 'apple-track-1',
      source: 'apple-music',
    })
    const createdUserTrack = createUserTrackFixture({
      track: {
        artist: persistedTrack.artist,
        externalId: persistedTrack.externalId,
        id: persistedTrack.id,
        source: persistedTrack.source,
        title: persistedTrack.title,
      },
    })
    const findByNormalizedTitleArtistMock = mock.fn(
      async (_titleNormalized: string, _artistNormalized: string) => undefined,
    )
    const createTrackMock = mock.fn(async (_input) => persistedTrack)
    const findByUserIdAndTrackIdMock = mock.fn(
      async (_userId: string, _trackId: string) => undefined,
    )
    const createWithTagsMock = mock.fn(
      async (_input, _tagIds: string[] | undefined) => createdUserTrack,
    )
    const findByIdMock = mock.fn(async (_id: string) => createdUserTrack)
    app.trackRepository.findByNormalizedTitleArtist = findByNormalizedTitleArtistMock
    app.trackRepository.create = createTrackMock
    app.userTrackRepository.findByUserIdAndTrackId = findByUserIdAndTrackIdMock
    app.userTrackRepository.createWithTags = createWithTagsMock
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          externalId: persistedTrack.externalId,
          track: {
            artist: persistedTrack.artist,
            title: persistedTrack.title,
          },
        },
        url: '/api/v1/user-tracks',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 201)
    assert.deepStrictEqual(createTrackMock.mock.calls[0].arguments[0], {
      artist: persistedTrack.artist,
      artistNormalized: 'the midnight',
      externalId: persistedTrack.externalId,
      source: 'apple-music',
      title: persistedTrack.title,
      titleNormalized: 'days of thunder',
    })
  })

  test('POST /user-tracks should return internal server error when created track cannot be reloaded', async () => {
    const persistedTrack = createTrackFixture()
    const createdUserTrack = createUserTrackFixture()
    const findByNormalizedTitleArtistMock = mock.fn(
      async (_titleNormalized: string, _artistNormalized: string) => persistedTrack,
    )
    const findByUserIdAndTrackIdMock = mock.fn(
      async (_userId: string, _trackId: string) => undefined,
    )
    const createWithTagsMock = mock.fn(
      async (_input, _tagIds: string[] | undefined) => createdUserTrack,
    )
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    app.trackRepository.findByNormalizedTitleArtist = findByNormalizedTitleArtistMock
    app.userTrackRepository.findByUserIdAndTrackId = findByUserIdAndTrackIdMock
    app.userTrackRepository.createWithTags = createWithTagsMock
    app.userTrackRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          track: {
            artist: persistedTrack.artist,
            title: persistedTrack.title,
          },
        },
        url: '/api/v1/user-tracks',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 500)
    assert.deepStrictEqual(response.json(), {
      error: 'Internal Server Error',
      message: 'Failed to create user track',
      statusCode: 500,
    })
    assert.deepStrictEqual(findByIdMock.mock.calls[0].arguments, [createdUserTrack.id])
  })

  test('PATCH /user-tracks/:id should update fields and tags', async () => {
    const existingUserTrack = createUserTrackFixture()
    const updatedUserTrack = createUserTrackFixture({
      listenedAt: new Date('2026-04-13T12:00:00.000Z'),
      note: 'Updated note',
      tags: [],
      youtubeUrl: null,
    })
    let findByIdCallCount = 0
    const findByIdMock = mock.fn(async (_id: string) => {
      findByIdCallCount += 1
      return findByIdCallCount === 1 ? existingUserTrack : updatedUserTrack
    })
    const updateTrackAndTagsMock = mock.fn(
      async (_old, _userTrackPatch, _trackPatch, _tagIds) => undefined,
    )
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.updateTrackAndTags = updateTrackAndTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          listenedAt: updatedUserTrack.listenedAt.toISOString(),
          note: updatedUserTrack.note,
          tagIds: [],
          youtubeUrl: null,
        },
        url: `/api/v1/user-tracks/${existingUserTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      userTrack: serializeUserTrack(updatedUserTrack),
    })
    assert.strictEqual(findByIdMock.mock.callCount(), 2)
    assert.deepStrictEqual(updateTrackAndTagsMock.mock.calls[0].arguments, [
      existingUserTrack,
      {
        listenedAt: updatedUserTrack.listenedAt,
        note: updatedUserTrack.note,
        youtubeUrl: null,
      },
      undefined,
      [],
    ])
  })

  test('PATCH /user-tracks/:id should reject changing to a track the user already logged', async () => {
    const existingUserTrack = createUserTrackFixture()
    const duplicateTrack = createTrackFixture({
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Midnight City',
    })
    const duplicateUserTrack = createUserTrackFixture({
      id: '77777777-7777-4777-8777-777777777777',
      track: {
        artist: duplicateTrack.artist,
        externalId: duplicateTrack.externalId,
        id: duplicateTrack.id,
        source: duplicateTrack.source,
        title: duplicateTrack.title,
      },
      trackId: duplicateTrack.id,
    })
    const findByIdMock = mock.fn(async (_id: string) => existingUserTrack)
    const findByNormalizedTitleArtistMock = mock.fn(
      async (_titleNormalized: string, _artistNormalized: string) => duplicateTrack,
    )
    const findByUserIdAndTrackIdMock = mock.fn(
      async (_userId: string, _trackId: string) => duplicateUserTrack,
    )
    const updateTrackAndTagsMock = mock.fn(
      async (_old, _userTrackPatch, _trackPatch, _tagIds) => undefined,
    )
    app.userTrackRepository.findById = findByIdMock
    app.trackRepository.findByNormalizedTitleArtist = findByNormalizedTitleArtistMock
    app.userTrackRepository.findByUserIdAndTrackId = findByUserIdAndTrackIdMock
    app.userTrackRepository.updateTrackAndTags = updateTrackAndTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          track: {
            artist: duplicateTrack.artist,
            title: duplicateTrack.title,
          },
        },
        url: `/api/v1/user-tracks/${existingUserTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 409)
    assert.deepStrictEqual(response.json(), {
      error: 'Conflict',
      message: 'You have already logged this track',
      statusCode: 409,
    })
    assert.deepStrictEqual(findByNormalizedTitleArtistMock.mock.calls[0].arguments, [
      'midnight city',
      'the midnight',
    ])
    assert.strictEqual(updateTrackAndTagsMock.mock.callCount(), 0)
  })

  test('PATCH /user-tracks/:id should return not found when user track belongs to another user', async () => {
    const userTrack = createUserTrackFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => userTrack)
    const updateTrackAndTagsMock = mock.fn(
      async (_old, _userTrackPatch, _trackPatch, _tagIds) => undefined,
    )
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.updateTrackAndTags = updateTrackAndTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          note: 'Updated note',
        },
        url: `/api/v1/user-tracks/${userTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
    assert.strictEqual(updateTrackAndTagsMock.mock.callCount(), 0)
  })

  test('PATCH /user-tracks/:id should return not found when user track does not exist', async () => {
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    const updateTrackAndTagsMock = mock.fn(
      async (_old, _userTrackPatch, _trackPatch, _tagIds) => undefined,
    )
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.updateTrackAndTags = updateTrackAndTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          note: 'Updated note',
        },
        url: `/api/v1/user-tracks/${userTrackId}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
    assert.strictEqual(updateTrackAndTagsMock.mock.callCount(), 0)
  })

  test('PATCH /user-tracks/:id should return internal server error when updated track cannot be reloaded', async () => {
    const existingUserTrack = createUserTrackFixture()
    let findByIdCallCount = 0
    const findByIdMock = mock.fn(async (_id: string) => {
      findByIdCallCount += 1
      return findByIdCallCount === 1 ? existingUserTrack : undefined
    })
    const updateTrackAndTagsMock = mock.fn(
      async (_old, _userTrackPatch, _trackPatch, _tagIds) => undefined,
    )
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.updateTrackAndTags = updateTrackAndTagsMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          note: 'Updated note',
        },
        url: `/api/v1/user-tracks/${existingUserTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 500)
    assert.deepStrictEqual(response.json(), {
      error: 'Internal Server Error',
      message: 'Failed to update user track',
      statusCode: 500,
    })
    assert.strictEqual(updateTrackAndTagsMock.mock.callCount(), 1)
    assert.strictEqual(findByIdMock.mock.callCount(), 2)
  })

  test('DELETE /user-tracks/:id should delete a user track owned by authenticated user', async () => {
    const userTrack = createUserTrackFixture()
    const findByIdMock = mock.fn(async (_id: string) => userTrack)
    const deleteMock = mock.fn(async (_id: string) => undefined)
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.delete = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user-tracks/${userTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 204)
    assert.strictEqual(response.body, '')
    assert.deepStrictEqual(deleteMock.mock.calls[0].arguments, [userTrack.id])
  })

  test('DELETE /user-tracks/:id should return not found when user track belongs to another user', async () => {
    const userTrack = createUserTrackFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => userTrack)
    const deleteMock = mock.fn(async (_id: string) => undefined)
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.delete = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user-tracks/${userTrack.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
    assert.strictEqual(deleteMock.mock.callCount(), 0)
  })

  test('DELETE /user-tracks/:id should return not found when user track does not exist', async () => {
    const findByIdMock = mock.fn(async (_id: string) => undefined)
    const deleteMock = mock.fn(async (_id: string) => undefined)
    app.userTrackRepository.findById = findByIdMock
    app.userTrackRepository.delete = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user-tracks/${userTrackId}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'User track not found',
      statusCode: 404,
    })
    assert.strictEqual(deleteMock.mock.callCount(), 0)
  })
})
