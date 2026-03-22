import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Fastify from 'fastify'
import fp from 'fastify-plugin'
import authPlugin from '../../src/plugins/auth.ts'
import { TokenService } from '../../src/plugins/token.ts'
import { mockConfig } from '../helper.ts'

// Mock token-service plugin
const mockTokenPlugin = fp(
  async (app) => {
    app.decorate('tokenService', new TokenService(mockConfig))
  },
  { name: 'token-service' },
)

describe('authPlugin', () => {
  it('should decorate request with user property', async () => {
    const app = Fastify()

    await app.register(mockTokenPlugin)
    await app.register(authPlugin, { config: mockConfig })

    app.get('/test', async (req, _reply) => {
      return { user: req.user }
    })

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    })

    assert.equal(response.statusCode, 200)
    const body = JSON.parse(response.body)
    assert.equal(body.user, null)
  })

  it('should decorate app with authenticate method', async () => {
    const app = Fastify()

    await app.register(mockTokenPlugin)
    await app.register(authPlugin, { config: mockConfig })

    assert.ok(app.authenticate)
    assert.equal(typeof app.authenticate, 'function')
  })

  describe('authenticate', () => {
    it('should authenticate with valid token', async () => {
      const app = Fastify()

      await app.register(mockTokenPlugin)
      await app.register(authPlugin, { config: mockConfig })

      const { accessToken } = app.tokenService.issueTokenPair({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tokenVersion: 1,
        },
        family: 'family-uuid-123',
      })

      app.get('/protected', {
        preHandler: app.authenticate,
        handler: async (req) => {
          return { user: req.user }
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      assert.equal(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.equal(body.user.sub, 'user-123')
      assert.equal(body.user.email, 'test@example.com')
      assert.equal(body.user.tokenVersion, 1)
    })

    it('should return 401 when authorization header is missing', async () => {
      const app = Fastify()

      await app.register(mockTokenPlugin)
      await app.register(authPlugin, { config: mockConfig })

      app.get('/protected', {
        preHandler: app.authenticate,
        handler: async () => {
          return { success: true }
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      })

      assert.equal(response.statusCode, 401)
      const body = JSON.parse(response.body)
      assert.equal(body.error, 'Unauthorized')
    })

    it('should return 401 when token is invalid', async () => {
      const app = Fastify()

      await app.register(mockTokenPlugin)
      await app.register(authPlugin, { config: mockConfig })

      app.get('/protected', {
        preHandler: app.authenticate,
        handler: async () => {
          return { success: true }
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      assert.equal(response.statusCode, 401)
      const body = JSON.parse(response.body)
      assert.equal(body.error, 'Unauthorized')
    })

    it('should return 401 when authorization header format is invalid', async () => {
      const app = Fastify()

      await app.register(mockTokenPlugin)
      await app.register(authPlugin, { config: mockConfig })

      app.get('/protected', {
        preHandler: app.authenticate,
        handler: async () => {
          return { success: true }
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'InvalidFormat',
        },
      })

      assert.equal(response.statusCode, 401)
      const body = JSON.parse(response.body)
      assert.equal(body.error, 'Unauthorized')
    })
  })
})
