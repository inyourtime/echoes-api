import assert from 'node:assert/strict'
import test from 'node:test'
import { buildE2eApp, getCookieValue } from './helper.ts'

test('registers, verifies, signs in, and manages a music timeline', async (t) => {
  const { app, sentEmails } = await buildE2eApp(t)

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'E2E.User@example.com',
      name: 'E2E User',
      password: 'password123',
    },
  })

  assert.equal(registerResponse.statusCode, 201)
  assert.deepEqual(registerResponse.json().user.email, 'e2e.user@example.com')
  assert.equal(sentEmails.length, 1)
  assert.equal(sentEmails[0]?.type, 'verification')
  assert.equal(sentEmails[0]?.email, 'e2e.user@example.com')

  const loginBeforeVerificationResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'e2e.user@example.com',
      password: 'password123',
    },
  })

  assert.equal(loginBeforeVerificationResponse.statusCode, 403)

  const verificationToken = new URL(sentEmails[0]!.link).searchParams.get('token')
  assert.ok(verificationToken)

  const verifyEmailResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-email',
    payload: {
      token: verificationToken,
    },
  })

  assert.equal(verifyEmailResponse.statusCode, 200)

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'user-agent': 'echoes-e2e',
    },
    payload: {
      email: 'e2e.user@example.com',
      password: 'password123',
    },
  })

  assert.equal(loginResponse.statusCode, 200)
  const accessToken = loginResponse.json().accessToken
  assert.equal(typeof accessToken, 'string')

  const refreshToken = getCookieValue(loginResponse, 'refreshToken')
  assert.ok(refreshToken)

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })

  assert.equal(meResponse.statusCode, 200)
  assert.deepEqual(meResponse.json().user, {
    avatarUrl: null,
    email: 'e2e.user@example.com',
    id: registerResponse.json().user.id,
    name: 'E2E User',
  })

  const createTagResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tags',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      color: '#3366ff',
      name: 'Road trip',
    },
  })

  assert.equal(createTagResponse.statusCode, 201)
  const tag = createTagResponse.json().tag

  const createTrackResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/user-tracks',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      listenedAt: '2026-04-12T09:30:00.000Z',
      note: 'Window down, city lights up',
      tagIds: [tag.id],
      track: {
        artist: 'The Midnight',
        title: 'Days of Thunder',
      },
      youtubeUrl: 'https://www.youtube.com/watch?v=test123',
    },
  })

  assert.equal(createTrackResponse.statusCode, 201)
  assert.equal(createTrackResponse.json().userTrack.track.title, 'Days of Thunder')
  assert.deepEqual(
    createTrackResponse.json().userTrack.tags.map((item: { name: string }) => item.name),
    ['Road trip'],
  )

  const listTracksResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/user-tracks',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })

  assert.equal(listTracksResponse.statusCode, 200)
  assert.equal(listTracksResponse.json().userTracks.length, 1)
  assert.equal(listTracksResponse.json().userTracks[0].note, 'Window down, city lights up')
  assert.deepEqual(listTracksResponse.json().meta, {
    limit: 20,
    nextCursor: null,
  })

  const searchTracksResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/user-tracks/search',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      limit: 10,
      search: 'midnight thunder',
      tagIds: [tag.id],
    },
  })

  assert.equal(searchTracksResponse.statusCode, 200)
  assert.equal(searchTracksResponse.json().userTracks.length, 1)
  assert.equal(searchTracksResponse.json().userTracks[0].track.artist, 'The Midnight')

  const refreshResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie: `refreshToken=${refreshToken}`,
    },
  })

  assert.equal(refreshResponse.statusCode, 200)
  assert.equal(typeof refreshResponse.json().accessToken, 'string')

  const rotatedRefreshToken = getCookieValue(refreshResponse, 'refreshToken')
  assert.ok(rotatedRefreshToken)

  const logoutResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: {
      authorization: `Bearer ${refreshResponse.json().accessToken}`,
      cookie: `refreshToken=${rotatedRefreshToken}`,
    },
  })

  assert.equal(logoutResponse.statusCode, 200)

  const refreshAfterLogoutResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie: `refreshToken=${rotatedRefreshToken}`,
    },
  })

  assert.equal(refreshAfterLogoutResponse.statusCode, 401)
})
