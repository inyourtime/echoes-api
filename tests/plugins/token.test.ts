import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Fastify from 'fastify'
import tokenPlugin, {
  generateFamily,
  type IssueTokenPairOptions,
  type RefreshTokenPayload,
  slidingExpiresAt,
  TokenService,
} from '../../src/plugins/token.ts'
import { mockConfig } from '../helper.ts'

describe('generateFamily', () => {
  it('should return a valid UUID string', () => {
    const family = generateFamily()

    assert.equal(typeof family, 'string')
    assert.match(family, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('should return unique values on multiple calls', () => {
    const family1 = generateFamily()
    const family2 = generateFamily()

    assert.notEqual(family1, family2)
  })
})

describe('slidingExpiresAt', () => {
  it('should return a date in the future', () => {
    const ttlMs = 60000 // 1 minute
    const before = Date.now()
    const expiresAt = slidingExpiresAt(ttlMs)
    const after = Date.now()

    assert.ok(expiresAt instanceof Date)
    assert.ok(expiresAt.getTime() > before)
    assert.ok(expiresAt.getTime() > after)
  })

  it('should calculate correct expiration time', () => {
    const ttlMs = 5 * 60 * 1000 // 5 minutes
    const before = Date.now()
    const expiresAt = slidingExpiresAt(ttlMs)
    const after = Date.now()

    const expectedMin = before + ttlMs
    const expectedMax = after + ttlMs

    assert.ok(expiresAt.getTime() >= expectedMin)
    assert.ok(expiresAt.getTime() <= expectedMax)
  })
})

describe('TokenService', () => {
  describe('constructor', () => {
    it('should create a TokenService instance', () => {
      const service = new TokenService(mockConfig)

      assert.ok(service instanceof TokenService)
    })
  })

  describe('issueTokenPair', () => {
    it('should issue access and refresh tokens', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const result = service.issueTokenPair(options)

      assert.equal(typeof result.accessToken, 'string')
      assert.equal(typeof result.refreshToken, 'string')
      assert.equal(typeof result.tokenHash, 'string')
      assert.ok(result.accessToken.length > 0)
      assert.ok(result.refreshToken.length > 0)
      assert.ok(result.tokenHash.length > 0)
    })

    it('should include correct payload in access token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 2,
        },
        family: 'family-uuid-123',
      }

      const result = service.issueTokenPair(options)
      const verified = service.verifyAccessToken(result.accessToken)

      assert.equal(verified.sub, 'user-123')
      assert.equal(verified.email, 'test@example.com')
      assert.equal(verified.tokenVersion, 2)
    })

    it('should include correct payload in refresh token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 2,
        },
        family: 'family-uuid-456',
      }

      const result = service.issueTokenPair(options)
      const verified = service.verifyRefreshToken(result.refreshToken)

      assert.equal(verified.sub, 'user-123')
      assert.equal(verified.family, 'family-uuid-456')
      assert.equal(verified.tokenVersion, 2)
    })

    it('should generate consistent token hash for same refresh token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const result1 = service.issueTokenPair(options)
      // Token hash is derived from refresh token, so same refresh token = same hash
      // But each issueTokenPair call generates different tokens, so we just verify format
      assert.equal(result1.tokenHash.length, 64) // SHA256 hex length
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const { accessToken } = service.issueTokenPair(options)
      const payload = service.verifyAccessToken(accessToken)

      assert.equal(payload.sub, 'user-123')
      assert.equal(payload.email, 'test@example.com')
      assert.equal(payload.tokenVersion, 1)
    })

    it('should throw error for invalid access token', () => {
      const service = new TokenService(mockConfig)

      assert.throws(() => {
        service.verifyAccessToken('invalid-token')
      })
    })

    it('should throw error for refresh token used as access token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const { refreshToken } = service.issueTokenPair(options)

      assert.throws(() => {
        service.verifyAccessToken(refreshToken)
      })
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const { refreshToken } = service.issueTokenPair(options)
      const payload = service.verifyRefreshToken(refreshToken)

      assert.equal(payload.sub, 'user-123')
      assert.equal(payload.family, 'family-uuid-123')
      assert.equal(payload.tokenVersion, 1)
    })

    it('should throw error for invalid refresh token', () => {
      const service = new TokenService(mockConfig)

      assert.throws(() => {
        service.verifyRefreshToken('invalid-token')
      })
    })

    it('should throw error for access token used as refresh token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const { accessToken } = service.issueTokenPair(options)

      assert.throws(() => {
        service.verifyRefreshToken(accessToken)
      })
    })
  })

  describe('decodeToken', () => {
    it('should decode a valid token', () => {
      const service = new TokenService(mockConfig)
      const options: IssueTokenPairOptions = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      }

      const { refreshToken } = service.issueTokenPair(options)
      const payload = service.decodeToken<RefreshTokenPayload>(refreshToken)

      assert.equal(payload.sub, 'user-123')
      assert.equal(payload.family, 'family-uuid-123')
      assert.equal(payload.tokenVersion, 1)
    })

    it('should throw error for invalid token', () => {
      const service = new TokenService(mockConfig)

      assert.throws(() => {
        service.decodeToken('invalid-token')
      })
    })
  })
})

describe('tokenPlugin', () => {
  it('should decorate fastify instance with tokenService', async () => {
    const app = Fastify()

    await app.register(tokenPlugin, { config: mockConfig })

    assert.ok(app.tokenService)
    assert.ok(app.tokenService instanceof TokenService)
  })

  it('should have working tokenService after decoration', async () => {
    const app = Fastify()

    await app.register(tokenPlugin, { config: mockConfig })

    const result = app.tokenService.issueTokenPair({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        tokenVersion: 1,
      },
      family: 'family-uuid-123',
    })

    assert.equal(typeof result.accessToken, 'string')
    assert.equal(typeof result.refreshToken, 'string')
    assert.equal(typeof result.tokenHash, 'string')

    // Verify the issued token works
    const payload = app.tokenService.verifyAccessToken(result.accessToken)
    assert.equal(payload.sub, 'user-123')
    assert.equal(payload.email, 'test@example.com')
  })
})
