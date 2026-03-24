import { TOKEN_ERROR_CODES } from 'fast-jwt'
import { generateFamily, type RefreshTokenPayload, slidingExpiresAt } from '../../plugins/token.ts'
import { defineRoute } from '../../utils/factories.ts'
import { hashPassword, hashToken, verifyPassword } from '../../utils/hash.ts'
import { LoginBody, MeResponse, RegisterBody, RegisterResponse, TokenResponse } from './schema.ts'

const route = defineRoute(
  {
    prefix: '/auth',
    tags: ['Auth'],
  },
  async (app, { config }) => {
    const { userRepository, refreshTokenRepository, tokenService } = app

    app.post(
      '/register',
      {
        config: { auth: false },
        schema: {
          summary: 'Register a new user',
          description: 'Register a new user',
          body: RegisterBody,
          response: {
            201: RegisterResponse,
            409: { $ref: 'responses#/properties/conflict', description: 'User already exists' },
          },
        },
      },
      async (request, reply) => {
        const { email, password, name } = request.body

        const emailLower = email.toLowerCase()

        // check if user already exists
        const existingUser = await userRepository.findByEmail(emailLower)
        if (existingUser) {
          throw app.httpErrors.conflict('User already exists')
        }

        const passwordHash = hashPassword(password)

        const user = await userRepository.create({
          email: emailLower,
          passwordHash,
          name,
        })

        return reply.code(201).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name || '',
          },
        })
      },
    )

    app.post(
      '/login',
      {
        config: { auth: false },
        schema: {
          body: LoginBody,
          summary: 'Login a user',
          description: 'Login a user',
          response: {
            200: TokenResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Invalid credentials' },
          },
        },
      },
      async (request, reply) => {
        const { email, password } = request.body

        const emailLower = email.toLowerCase()

        const user = await app.userRepository.findByEmail(emailLower)

        if (!user || !user.isActive) {
          throw app.httpErrors.unauthorized('Invalid credentials')
        }

        const isPasswordValid = verifyPassword(password, user.passwordHash || '')
        if (!isPasswordValid) {
          throw app.httpErrors.unauthorized('Invalid credentials')
        }

        const family = generateFamily()
        const expiresAt = slidingExpiresAt(config.jwt.slidingTTLMs)

        const { tokenHash, ...tokenPair } = tokenService.issueTokenPair({
          user,
          family,
        })

        await refreshTokenRepository.createOrUpdate({
          userId: user.id,
          family,
          expiresAt,
          tokenHash,
          tokenVersion: user.tokenVersion,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null,
          lastUsedAt: new Date(),
        })

        // set refresh token to cookie
        reply.setCookie('refreshToken', tokenPair.refreshToken, {
          ...app.getCookieOptions(expiresAt),
        })

        return reply.send({
          accessToken: tokenPair.accessToken,
        })
      },
    )

    app.get(
      '/me',
      {
        config: { auth: true },
        schema: {
          summary: 'Get current user',
          response: {
            200: MeResponse,
            404: { $ref: 'responses#/properties/notFound', description: 'User not found' },
          },
        },
      },
      async (request, reply) => {
        const user = await app.userRepository.findById(request.getUser().sub)
        if (!user) {
          throw app.httpErrors.notFound('User not found')
        }

        return reply.send({
          user,
        })
      },
    )

    app.post(
      '/refresh',
      {
        config: { auth: false },
        schema: {
          summary: 'Refresh access token',
          response: {
            200: TokenResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            403: { $ref: 'responses#/properties/forbidden', description: 'Account disabled' },
          },
        },
      },
      async (request, reply) => {
        const { refreshToken } = request.cookies
        if (!refreshToken) {
          throw app.httpErrors.unauthorized('Refresh token is required')
        }

        let payload: RefreshTokenPayload
        try {
          payload = tokenService.verifyRefreshToken(refreshToken)
        } catch (err) {
          // if token is not active yet, revoke it and return 401
          if (err instanceof Error && 'code' in err && err.code === TOKEN_ERROR_CODES.inactive) {
            const decoded = tokenService.decodeToken<RefreshTokenPayload>(refreshToken)
            await refreshTokenRepository.deleteByFamily(decoded.family)
            throw app.httpErrors.unauthorized('Token is not active yet')
          }

          throw app.httpErrors.unauthorized('Invalid or expired refresh token')
        }

        const stored = await refreshTokenRepository.findByFamily(payload.family)
        if (!stored) {
          throw app.httpErrors.unauthorized('Refresh token not found')
        }

        const hashedToken = hashToken(refreshToken)
        if (stored.tokenHash !== hashedToken) {
          await refreshTokenRepository.deleteByFamily(payload.family)
          throw app.httpErrors.unauthorized('Token reuse detected — please login again')
        }

        if (stored.user.tokenVersion !== payload.tokenVersion) {
          await refreshTokenRepository.deleteByFamily(payload.family)
          throw app.httpErrors.unauthorized('Token invalidated — please login again')
        }

        if (!stored.user.isActive) {
          throw app.httpErrors.forbidden('Account disabled')
        }

        const expiresAt = slidingExpiresAt(config.jwt.slidingTTLMs)

        const { tokenHash, ...tokenPair } = tokenService.issueTokenPair({
          user: stored.user,
          family: stored.family,
        })

        await refreshTokenRepository.createOrUpdate({
          userId: stored.user.id,
          family: stored.family,
          expiresAt,
          tokenHash,
          tokenVersion: stored.user.tokenVersion,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null,
          lastUsedAt: new Date(),
        })

        // set refresh token to cookie
        reply.setCookie('refreshToken', tokenPair.refreshToken, {
          ...app.getCookieOptions(expiresAt),
        })

        return reply.send({
          accessToken: tokenPair.accessToken,
        })
      },
    )

    // app.get('/callback', { schema: { hide: true } }, async (request, reply) => {
    //   const { token } = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

    //   const fetchResult = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    //     headers: {
    //       Authorization: `Bearer ${token.access_token}`,
    //     },
    //   })

    //   if (!fetchResult.ok) {
    //     reply.send(new Error('Failed to fetch user info'))
    //     return
    //   }

    //   const data = await fetchResult.json()
    //   reply.send(data)
    // })
  },
)

export default route
