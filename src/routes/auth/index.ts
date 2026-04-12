import { TOKEN_ERROR_CODES } from 'fast-jwt'
import type { User, VerificationToken, VerificationTokenType } from '../../db/schema.ts'
import { generateFamily, type RefreshTokenPayload, slidingExpiresAt } from '../../plugins/token.ts'
import type { TypedRoutePlugin } from '../../utils/factories.ts'
import { generateToken, hashPassword, hashToken, verifyPassword } from '../../utils/hash.ts'
import {
  ForgotPasswordBody,
  ForgotPasswordResponse,
  LoginBody,
  LogoutResponse,
  MeResponse,
  RegisterBody,
  RegisterResponse,
  ResendVerificationBody,
  ResendVerificationResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  TokenResponse,
  VerifyEmailBody,
  VerifyEmailResponse,
} from './schema.ts'

const TAGS = ['Auth']
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const PASSWORD_RESET_EMAIL_SENT_MESSAGE =
  'If an account exists, a password reset email has been sent.'
const PASSWORD_RESET_SUCCESS_MESSAGE = 'Password reset successful. You can now log in.'
const EMAIL_VERIFICATION_SENT_MESSAGE = 'If an account exists, a verification email has been sent.'

const route: TypedRoutePlugin = async (app, { config }) => {
  const {
    userRepository,
    refreshTokenRepository,
    tokenService,
    verificationTokenRepository,
    mailerService,
    oauthAccountRepository,
  } = app

  async function createVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
  ) {
    const { rawToken, hashedToken } = generateToken()

    await verificationTokenRepository.create({
      userId,
      type,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + ttlMs),
    })

    return rawToken
  }

  async function findValidVerificationToken(
    token: string,
    type: VerificationTokenType,
  ): Promise<VerificationToken & { user: User }> {
    const hashedToken = hashToken(token)
    const verificationRecord = await verificationTokenRepository.findByTokenHash(hashedToken)

    if (!verificationRecord) {
      throw app.httpErrors.badRequest('Invalid token')
    }

    if (verificationRecord.usedAt) {
      throw app.httpErrors.badRequest('Token already used')
    }

    if (new Date() > verificationRecord.expiresAt) {
      throw app.httpErrors.badRequest('Token expired')
    }

    if (verificationRecord.type !== type) {
      throw app.httpErrors.badRequest('Invalid token type')
    }

    return verificationRecord
  }

  app.post(
    '/auth/register',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Register a new user',
        description:
          'Register a new user with email and password. An email verification token will be sent to the user.',
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

      // Generate and store verification token
      const rawToken = await createVerificationToken(
        user.id,
        'email_verification',
        VERIFICATION_TOKEN_TTL_MS,
      )

      // Send verification email
      const verificationLink = `${config.frontendUrl}/verify-email?token=${rawToken}`
      await mailerService.sendVerification(user.email, verificationLink)

      return reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
        },
        message: 'Registration successful. Please check your email to verify your account.',
      })
    },
  )

  app.post(
    '/auth/login',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        body: LoginBody,
        summary: 'Login a user',
        description:
          'Login a user with email and password. Returns access token and refresh token (via cookie). If email is not verified, returns 403.',
        response: {
          200: TokenResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Invalid credentials' },
          403: { $ref: 'responses#/properties/forbidden', description: 'Email not verified' },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      const emailLower = email.toLowerCase()

      const user = await app.userRepository.findByEmail(emailLower)

      if (!user?.isActive) {
        throw app.httpErrors.unauthorized('Email or password is incorrect')
      }

      if (!user.emailVerifiedAt) {
        throw app.httpErrors.forbidden('Please verify your email before logging in')
      }

      if (!user.passwordHash) {
        throw app.httpErrors.unauthorized('Email or password is incorrect')
      }

      const isPasswordValid = verifyPassword(password, user.passwordHash)
      if (!isPasswordValid) {
        throw app.httpErrors.unauthorized('Email or password is incorrect')
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

  app.post(
    '/auth/forgot-password',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Request a password reset email',
        description:
          'Send a password reset email if the account exists. Always returns success to prevent email enumeration.',
        body: ForgotPasswordBody,
        response: {
          200: ForgotPasswordResponse,
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body
      const emailLower = email.toLowerCase()
      const user = await userRepository.findByEmail(emailLower)

      if (!user?.isActive) {
        return reply.send({
          message: PASSWORD_RESET_EMAIL_SENT_MESSAGE,
        })
      }

      await verificationTokenRepository.deleteByUserAndType(user.id, 'password_reset')

      const rawToken = await createVerificationToken(
        user.id,
        'password_reset',
        PASSWORD_RESET_TOKEN_TTL_MS,
      )

      const resetLink = `${config.frontendUrl}/reset-password?token=${rawToken}`
      await mailerService.sendPasswordReset(user.email, resetLink)

      return reply.send({
        message: PASSWORD_RESET_EMAIL_SENT_MESSAGE,
      })
    },
  )

  app.post(
    '/auth/verify-email',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Verify email address',
        description: 'Verify email address using token from email. Returns success message.',
        body: VerifyEmailBody,
        response: {
          200: VerifyEmailResponse,
          400: {
            $ref: 'responses#/properties/badRequest',
            description: 'Invalid or expired token',
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.body

      const verificationRecord = await findValidVerificationToken(token, 'email_verification')

      // Mark token as used
      await verificationTokenRepository.markAsUsed(verificationRecord.id)

      // Verify user email
      await userRepository.verifyEmail(verificationRecord.userId)

      return reply.send({
        message: 'Email verified successfully. You can now log in.',
      })
    },
  )

  app.post(
    '/auth/resend-verification',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Resend verification email',
        description:
          'Resend verification email to user. Always returns success to prevent email enumeration.',
        body: ResendVerificationBody,
        response: {
          200: ResendVerificationResponse,
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body
      const emailLower = email.toLowerCase()

      const user = await userRepository.findByEmail(emailLower)

      // Always return success to prevent email enumeration
      if (!user) {
        return reply.send({
          message: EMAIL_VERIFICATION_SENT_MESSAGE,
        })
      }

      // Skip if already verified
      if (user.emailVerifiedAt) {
        return reply.send({
          message: EMAIL_VERIFICATION_SENT_MESSAGE,
        })
      }

      // Delete any existing unused tokens
      await verificationTokenRepository.deleteByUserAndType(user.id, 'email_verification')

      // Generate new token
      const rawToken = await createVerificationToken(
        user.id,
        'email_verification',
        VERIFICATION_TOKEN_TTL_MS,
      )

      // Send verification email
      const verificationLink = `${config.frontendUrl}/verify-email?token=${rawToken}`
      await mailerService.sendVerification(user.email, verificationLink)

      return reply.send({
        message: EMAIL_VERIFICATION_SENT_MESSAGE,
      })
    },
  )

  app.post(
    '/auth/reset-password',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Reset password using email token',
        description: 'Reset the user password using a valid password reset token.',
        body: ResetPasswordBody,
        response: {
          200: ResetPasswordResponse,
          400: {
            $ref: 'responses#/properties/badRequest',
            description: 'Invalid or expired token',
          },
        },
      },
    },
    async (request, reply) => {
      const { token, password } = request.body
      const verificationRecord = await findValidVerificationToken(token, 'password_reset')
      const passwordHash = hashPassword(password)

      await verificationTokenRepository.markAsUsed(verificationRecord.id)
      await userRepository.updatePassword(verificationRecord.userId, passwordHash)

      return reply.send({
        message: PASSWORD_RESET_SUCCESS_MESSAGE,
      })
    },
  )

  app.get(
    '/auth/me',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Get current user information',
        description: "Retrieve the authenticated user's information",
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
    '/auth/logout',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Logout user',
        description: 'Logout user by invalidating the refresh token and clearing the cookie',
        response: {
          200: LogoutResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.cookies

      if (refreshToken) {
        try {
          const payload = tokenService.decodeToken<RefreshTokenPayload>(refreshToken)
          await refreshTokenRepository.deleteByFamily(payload.family)
        } catch {
          // Token is invalid or expired, still clear the cookie
        }
      }

      // Clear the refresh token cookie
      reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: config.enableCookieSecure,
        sameSite: 'strict',
      })

      return reply.send({
        message: 'Logout successful',
      })
    },
  )

  app.post(
    '/auth/refresh',
    {
      config: { auth: false },
      schema: {
        tags: TAGS,
        summary: 'Refresh access token',
        description: 'Generate a new access token using a valid refresh token',
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

  app.get(
    '/auth/google/callback',
    {
      config: { auth: false },
      schema: { hide: true },
    },
    async (request, reply) => {
      const { token } = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

      // Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      })

      if (!userInfoResponse.ok) {
        throw app.httpErrors.internalServerError('Failed to fetch user info from Google')
      }

      const googleUser = (await userInfoResponse.json()) as {
        id: string
        email: string
        name?: string
        picture?: string
        verified_email?: boolean
      }

      const emailLower = googleUser.email.toLowerCase()

      // Check if OAuth account already exists
      const oauthAccount = await oauthAccountRepository.findByProviderAndAccountId(
        'google',
        googleUser.id,
      )

      let user: User

      if (oauthAccount) {
        // Existing OAuth user - update tokens and get user
        await oauthAccountRepository.updateTokens(oauthAccount.id, {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpiresAt: token.expires_at ? new Date(token.expires_at) : undefined,
        })
        user = oauthAccount.user
      } else {
        // Check if user exists with same email
        const existingUser = await userRepository.findByEmail(emailLower)

        if (existingUser) {
          // Link OAuth to existing user
          user = existingUser
          await oauthAccountRepository.create({
            userId: existingUser.id,
            provider: 'google',
            providerAccountId: googleUser.id,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            tokenExpiresAt: token.expires_at ? new Date(token.expires_at) : undefined,
          })
          // Mark email as verified if not already
          if (!existingUser.emailVerifiedAt && googleUser.verified_email) {
            await userRepository.verifyEmail(existingUser.id)
          }
        } else {
          // Create new user and OAuth account
          user = await userRepository.create({
            email: emailLower,
            name: googleUser.name || null,
            avatarUrl: googleUser.picture || null,
            emailVerifiedAt: googleUser.verified_email ? new Date() : null,
          })

          await oauthAccountRepository.create({
            userId: user.id,
            provider: 'google',
            providerAccountId: googleUser.id,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            tokenExpiresAt: token.expires_at ? new Date(token.expires_at) : undefined,
          })
        }
      }

      if (!user.isActive) {
        throw app.httpErrors.forbidden('Account disabled')
      }

      // Issue tokens
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

      // Set refresh token cookie and redirect to frontend with access token
      reply.setCookie('refreshToken', tokenPair.refreshToken, {
        ...app.getCookieOptions(expiresAt),
      })

      // Redirect to frontend with access token as fragment (not sent to server)
      const redirectUrl = new URL(`${config.frontendUrl}/auth/google/callback`)
      redirectUrl.hash = `access_token=${tokenPair.accessToken}`

      return reply.redirect(redirectUrl.toString())
    },
  )
}

export default route
