import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { OAuth2Token } from '@fastify/oauth2'
import type { FastifyInstance } from 'fastify'
import { HttpResponse, http } from 'msw'
import type { OauthAccount, User } from '../../../src/db/schema.ts'
import type { IssueTokenPairOptions, TokenPair } from '../../../src/plugins/token.ts'
import { buildTestApp, server } from '../../helper.ts'

const userAgent = 'oauth-callback-test'

function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    emailVerifiedAt: null,
    passwordHash: null,
    name: 'Test User',
    avatarUrl: null,
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createOauthAccountFixture(overrides: Partial<OauthAccount> = {}): OauthAccount {
  return {
    id: 'oauth-account-1',
    userId: 'user-1',
    provider: 'google',
    providerAccountId: 'provider-account-1',
    accessToken: 'provider-access-token',
    refreshToken: 'provider-refresh-token',
    tokenExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
    scope: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createOAuth2TokenFixture(token: OAuth2Token['token']): OAuth2Token {
  return {
    token,
    expired: () => false,
    refresh: async () => createOAuth2TokenFixture(token),
    revoke: async () => undefined,
    revokeAll: async () => undefined,
  }
}

describe('OAuth callback routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('GET /auth/google/callback should create a user from Google profile and redirect', async () => {
    server.use(
      http.get('https://www.googleapis.com/oauth2/v2/userinfo', ({ request }) => {
        assert.strictEqual(request.headers.get('authorization'), 'Bearer google-access-token')

        return HttpResponse.json({
          id: 'google-user-1',
          email: 'TEST@example.com',
          name: 'Google User',
          picture: 'https://example.com/google-avatar.png',
          verified_email: true,
        })
      }),
    )

    const existingOauthAccountMock = mock.fn(async () => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const createUserMock = mock.fn(async (_input) => {
      return createUserFixture({
        id: 'google-created-user',
        email: 'test@example.com',
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        name: 'Google User',
        avatarUrl: 'https://example.com/google-avatar.png',
      })
    })
    const createOauthAccountMock = mock.fn(async (_input) =>
      createOauthAccountFixture({
        id: 'oauth-account-1',
        userId: 'google-created-user',
        provider: 'google',
        providerAccountId: 'google-user-1',
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
        tokenExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    )
    const verifyEmailMock = mock.fn(async (_id: string) => undefined)
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      return {
        accessToken: 'issued-access-token',
        refreshToken: 'issued-refresh-token',
        tokenHash: 'issued-token-hash',
      }
    })
    const createOrUpdateMock = mock.fn(async (_input) => undefined)
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        expires_in: 3600,
        expires_at: new Date('2026-02-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = existingOauthAccountMock
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.userRepository.verifyEmail =
      verifyEmailMock as unknown as typeof app.userRepository.verifyEmail
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/google/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 302)
    assert.strictEqual(
      response.headers.location,
      'http://localhost:3000/oauth/callback#provider=google&access_token=issued-access-token',
    )

    const setCookieHeader = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'][0]
      : response.headers['set-cookie'] || ''
    assert.match(setCookieHeader, /refreshToken=issued-refresh-token/)

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(existingOauthAccountMock.mock.callCount(), 1)
    assert.deepStrictEqual(existingOauthAccountMock.mock.calls[0].arguments, [
      'google',
      'google-user-1',
    ])

    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], 'test@example.com')

    assert.strictEqual(createUserMock.mock.callCount(), 1)
    assert.deepStrictEqual(createUserMock.mock.calls[0].arguments[0], {
      email: 'test@example.com',
      name: 'Google User',
      avatarUrl: 'https://example.com/google-avatar.png',
      emailVerifiedAt: createUserMock.mock.calls[0].arguments[0].emailVerifiedAt,
    })
    assert.ok(createUserMock.mock.calls[0].arguments[0].emailVerifiedAt instanceof Date)

    assert.strictEqual(createOauthAccountMock.mock.callCount(), 1)
    assert.deepStrictEqual(createOauthAccountMock.mock.calls[0].arguments[0], {
      userId: 'google-created-user',
      provider: 'google',
      providerAccountId: 'google-user-1',
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
      tokenExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
    })

    assert.strictEqual(verifyEmailMock.mock.callCount(), 0)

    assert.strictEqual(issueTokenPairMock.mock.callCount(), 1)
    assert.strictEqual(issueTokenPairMock.mock.calls[0].arguments[0].user.id, 'google-created-user')
    assert.match(
      issueTokenPairMock.mock.calls[0].arguments[0].family,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    assert.strictEqual(createOrUpdateMock.mock.callCount(), 1)
    assert.strictEqual(createOrUpdateMock.mock.calls[0].arguments[0].userId, 'google-created-user')
    assert.strictEqual(createOrUpdateMock.mock.calls[0].arguments[0].userAgent, userAgent)
    assert.strictEqual(createOrUpdateMock.mock.calls[0].arguments[0].tokenHash, 'issued-token-hash')
  })

  test('GET /auth/google/callback should return 500 when Google user info request fails', async () => {
    server.use(
      http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const findByProviderAndAccountIdMock = mock.fn(async () => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const createUserMock = mock.fn(async (_input) => {
      throw new Error('userRepository.create should not be called')
    })
    const createOauthAccountMock = mock.fn(async (_input) => {
      throw new Error('oauthAccountRepository.create should not be called')
    })
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('tokenService.issueTokenPair should not be called')
    })
    const createOrUpdateMock = mock.fn(async (_input) => {
      throw new Error('refreshTokenRepository.createOrUpdate should not be called')
    })
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        expires_in: 3600,
        expires_at: new Date('2026-02-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = findByProviderAndAccountIdMock
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/google/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 500)
    assert.deepStrictEqual(response.json(), {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch user info from Google',
    })

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(findByProviderAndAccountIdMock.mock.callCount(), 0)
    assert.strictEqual(findByEmailMock.mock.callCount(), 0)
    assert.strictEqual(createUserMock.mock.callCount(), 0)
    assert.strictEqual(createOauthAccountMock.mock.callCount(), 0)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('GET /auth/google/callback should return 403 when OAuth user account is disabled', async () => {
    server.use(
      http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
        return HttpResponse.json({
          id: 'google-user-disabled',
          email: 'disabled@example.com',
          name: 'Disabled User',
          picture: 'https://example.com/disabled-avatar.png',
          verified_email: true,
        })
      }),
    )

    const disabledUser = createUserFixture({
      id: 'disabled-user-1',
      email: 'disabled@example.com',
      isActive: false,
    })

    const findByProviderAndAccountIdMock = mock.fn(async () => ({
      id: 'oauth-account-disabled',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'disabled-user-1',
      provider: 'google' as const,
      providerAccountId: 'google-user-disabled',
      accessToken: 'stored-access-token',
      refreshToken: 'stored-refresh-token',
      tokenExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      scope: null,
      user: disabledUser,
    }))
    const updateTokensMock = mock.fn(async (_id: string, _tokens) => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const createUserMock = mock.fn(async (_input) => {
      throw new Error('userRepository.create should not be called')
    })
    const createOauthAccountMock = mock.fn(async (_input) => {
      throw new Error('oauthAccountRepository.create should not be called')
    })
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('tokenService.issueTokenPair should not be called')
    })
    const createOrUpdateMock = mock.fn(async (_input) => {
      throw new Error('refreshTokenRepository.createOrUpdate should not be called')
    })
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        expires_in: 3600,
        expires_at: new Date('2026-04-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = findByProviderAndAccountIdMock
    app.oauthAccountRepository.updateTokens =
      updateTokensMock as unknown as typeof app.oauthAccountRepository.updateTokens
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/google/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 403)
    assert.deepStrictEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Account disabled',
    })

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(findByProviderAndAccountIdMock.mock.callCount(), 1)
    assert.strictEqual(updateTokensMock.mock.callCount(), 1)
    assert.strictEqual(updateTokensMock.mock.calls[0].arguments[0], 'oauth-account-disabled')
    assert.strictEqual(findByEmailMock.mock.callCount(), 0)
    assert.strictEqual(createUserMock.mock.callCount(), 0)
    assert.strictEqual(createOauthAccountMock.mock.callCount(), 0)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
    assert.strictEqual(response.headers.location, undefined)
    assert.strictEqual(response.headers['set-cookie'], undefined)
  })

  test('GET /auth/line/callback should link an existing user and verify email', async () => {
    server.use(
      http.post('https://api.line.me/oauth2/v2.1/verify', async ({ request }) => {
        const body = await request.text()
        assert.match(body, /id_token=line-id-token/)
        assert.match(body, /client_id=test-client-id/)

        return HttpResponse.json({
          sub: 'line-user-1',
          email: 'LINE@example.com',
          name: 'Line User',
          picture: 'https://example.com/line-avatar.png',
        })
      }),
    )

    const existingUser = createUserFixture({
      id: 'existing-user-1',
      email: 'line@example.com',
      emailVerifiedAt: null,
      name: 'Existing User',
    })

    const existingOauthAccountMock = mock.fn(async () => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => existingUser)
    const createUserMock = mock.fn(async (_input) => {
      throw new Error('userRepository.create should not be called')
    })
    const verifyEmailMock = mock.fn(async (_id: string) => undefined)
    const createOauthAccountMock = mock.fn(async (_input) =>
      createOauthAccountFixture({
        id: 'oauth-account-2',
        userId: 'existing-user-1',
        provider: 'line',
        providerAccountId: 'line-user-1',
        accessToken: 'line-access-token',
        refreshToken: 'line-refresh-token',
        tokenExpiresAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    )
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      return {
        accessToken: 'line-issued-access-token',
        refreshToken: 'line-issued-refresh-token',
        tokenHash: 'line-issued-token-hash',
      }
    })
    const createOrUpdateMock = mock.fn(async (_input) => undefined)
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'line-access-token',
        refresh_token: 'line-refresh-token',
        id_token: 'line-id-token',
        expires_in: 3600,
        expires_at: new Date('2026-03-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = existingOauthAccountMock
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.userRepository.verifyEmail =
      verifyEmailMock as unknown as typeof app.userRepository.verifyEmail
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/line/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 302)
    assert.strictEqual(
      response.headers.location,
      'http://localhost:3000/oauth/callback#provider=line&access_token=line-issued-access-token',
    )

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(existingOauthAccountMock.mock.callCount(), 1)
    assert.deepStrictEqual(existingOauthAccountMock.mock.calls[0].arguments, [
      'line',
      'line-user-1',
    ])

    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], 'line@example.com')

    assert.strictEqual(createUserMock.mock.callCount(), 0)

    assert.strictEqual(createOauthAccountMock.mock.callCount(), 1)
    assert.deepStrictEqual(createOauthAccountMock.mock.calls[0].arguments[0], {
      userId: 'existing-user-1',
      provider: 'line',
      providerAccountId: 'line-user-1',
      accessToken: 'line-access-token',
      refreshToken: 'line-refresh-token',
      tokenExpiresAt: new Date('2026-03-01T00:00:00.000Z'),
    })

    assert.strictEqual(verifyEmailMock.mock.callCount(), 1)
    assert.strictEqual(verifyEmailMock.mock.calls[0].arguments[0], 'existing-user-1')

    assert.strictEqual(issueTokenPairMock.mock.callCount(), 1)
    assert.strictEqual(issueTokenPairMock.mock.calls[0].arguments[0].user.id, 'existing-user-1')

    assert.strictEqual(createOrUpdateMock.mock.callCount(), 1)
    assert.strictEqual(createOrUpdateMock.mock.calls[0].arguments[0].userId, 'existing-user-1')
    assert.strictEqual(
      createOrUpdateMock.mock.calls[0].arguments[0].tokenHash,
      'line-issued-token-hash',
    )
    assert.strictEqual(createOrUpdateMock.mock.calls[0].arguments[0].userAgent, userAgent)
  })

  test('GET /auth/line/callback should return 500 when LINE verify request fails', async () => {
    server.use(
      http.post('https://api.line.me/oauth2/v2.1/verify', () => {
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const findByProviderAndAccountIdMock = mock.fn(async () => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => undefined)
    const createUserMock = mock.fn(async (_input) => {
      throw new Error('userRepository.create should not be called')
    })
    const createOauthAccountMock = mock.fn(async (_input) => {
      throw new Error('oauthAccountRepository.create should not be called')
    })
    const verifyEmailMock = mock.fn(async (_id: string) => {
      throw new Error('userRepository.verifyEmail should not be called')
    })
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('tokenService.issueTokenPair should not be called')
    })
    const createOrUpdateMock = mock.fn(async (_input) => {
      throw new Error('refreshTokenRepository.createOrUpdate should not be called')
    })
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'line-access-token',
        refresh_token: 'line-refresh-token',
        id_token: 'line-id-token',
        expires_in: 3600,
        expires_at: new Date('2026-03-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = findByProviderAndAccountIdMock
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.create = createUserMock
    app.userRepository.verifyEmail =
      verifyEmailMock as unknown as typeof app.userRepository.verifyEmail
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/line/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 500)
    assert.deepStrictEqual(response.json(), {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch user info from LINE',
    })

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(findByProviderAndAccountIdMock.mock.callCount(), 0)
    assert.strictEqual(findByEmailMock.mock.callCount(), 0)
    assert.strictEqual(createUserMock.mock.callCount(), 0)
    assert.strictEqual(createOauthAccountMock.mock.callCount(), 0)
    assert.strictEqual(verifyEmailMock.mock.callCount(), 0)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
  })

  test('GET /auth/line/callback should return 403 when linked user account is disabled', async () => {
    server.use(
      http.post('https://api.line.me/oauth2/v2.1/verify', () => {
        return HttpResponse.json({
          sub: 'line-user-disabled',
          email: 'disabled-line@example.com',
          name: 'Disabled Line User',
          picture: 'https://example.com/disabled-line-avatar.png',
        })
      }),
    )

    const disabledUser = createUserFixture({
      id: 'disabled-line-user-1',
      email: 'disabled-line@example.com',
      emailVerifiedAt: new Date(),
      isActive: false,
    })

    const findByProviderAndAccountIdMock = mock.fn(async () => undefined)
    const findByEmailMock = mock.fn(async (_email: string) => disabledUser)
    const verifyEmailMock = mock.fn(async (_id: string) => undefined)
    const createUserMock = mock.fn(async (_input) => {
      throw new Error('userRepository.create should not be called')
    })
    const createOauthAccountMock = mock.fn(async (_input) =>
      createOauthAccountFixture({
        id: 'oauth-account-disabled-line',
        userId: 'disabled-line-user-1',
        provider: 'line',
        providerAccountId: 'line-user-disabled',
        accessToken: 'line-access-token',
        refreshToken: 'line-refresh-token',
        tokenExpiresAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    )
    const issueTokenPairMock = mock.fn((_options: IssueTokenPairOptions): TokenPair => {
      throw new Error('tokenService.issueTokenPair should not be called')
    })
    const createOrUpdateMock = mock.fn(async (_input) => {
      throw new Error('refreshTokenRepository.createOrUpdate should not be called')
    })
    const getAccessTokenMock = mock.fn(async () =>
      createOAuth2TokenFixture({
        token_type: 'Bearer',
        access_token: 'line-access-token',
        refresh_token: 'line-refresh-token',
        id_token: 'line-id-token',
        expires_in: 3600,
        expires_at: new Date('2026-05-01T00:00:00.000Z'),
      }),
    )

    app.oauthAccountRepository.findByProviderAndAccountId = findByProviderAndAccountIdMock
    app.userRepository.findByEmail = findByEmailMock
    app.userRepository.verifyEmail =
      verifyEmailMock as unknown as typeof app.userRepository.verifyEmail
    app.userRepository.create = createUserMock
    app.oauthAccountRepository.create =
      createOauthAccountMock as unknown as typeof app.oauthAccountRepository.create
    app.tokenService.issueTokenPair = issueTokenPairMock
    app.refreshTokenRepository.createOrUpdate = createOrUpdateMock
    app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow =
      getAccessTokenMock as unknown as typeof app.lineOAuth2.getAccessTokenFromAuthorizationCodeFlow

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/line/callback?code=test-code&state=test-state',
      headers: {
        'user-agent': userAgent,
      },
    })

    assert.strictEqual(response.statusCode, 403)
    assert.deepStrictEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Account disabled',
    })

    assert.strictEqual(getAccessTokenMock.mock.callCount(), 1)
    assert.strictEqual(findByProviderAndAccountIdMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.callCount(), 1)
    assert.strictEqual(findByEmailMock.mock.calls[0].arguments[0], 'disabled-line@example.com')
    assert.strictEqual(createOauthAccountMock.mock.callCount(), 1)
    assert.strictEqual(verifyEmailMock.mock.callCount(), 0)
    assert.strictEqual(createUserMock.mock.callCount(), 0)
    assert.strictEqual(issueTokenPairMock.mock.callCount(), 0)
    assert.strictEqual(createOrUpdateMock.mock.callCount(), 0)
    assert.strictEqual(response.headers.location, undefined)
    assert.strictEqual(response.headers['set-cookie'], undefined)
  })
})
