import crypto from 'node:crypto'
import { createDecoder, createSigner, createVerifier, type SignerPayload } from 'fast-jwt'
import { definePlugin } from '#utils/factories'
import type { IConfig } from '../config/index.ts'
import { hashToken } from '../utils/hash.ts'

declare module 'fastify' {
  interface FastifyInstance {
    tokenService: TokenService
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateFamily(): string {
  return crypto.randomUUID()
}

/** Sliding expiry — นับจาก now ทุกครั้งที่ rotate */
export function slidingExpiresAt(slidingTTLMs: number): Date {
  return new Date(Date.now() + slidingTTLMs)
}

export interface IssueTokenPairOptions {
  user: { id: string; email: string; tokenVersion: number }
  family: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenHash: string
}

export interface AccessTokenPayload {
  sub: string
  email: string
  tokenVersion: number
}

export interface RefreshTokenPayload {
  sub: string
  family: string
  tokenVersion: number
}

export class TokenService {
  #accessSigner: (payload: SignerPayload) => string
  #accessVerifier: (token: string) => any
  #refreshSigner: (payload: SignerPayload) => string
  #refreshVerifier: (token: string) => any
  #decoder: (token: string) => any

  constructor(config: IConfig) {
    this.#accessSigner = createSigner({
      key: config.jwt.accessTokenSecret,
      algorithm: 'HS256',
      expiresIn: config.jwt.accessTokenTTL,
    })

    this.#accessVerifier = createVerifier({
      key: config.jwt.accessTokenSecret,
    })

    this.#refreshSigner = createSigner({
      key: config.jwt.refreshTokenSecret,
      algorithm: 'HS256',
      expiresIn: config.jwt.slidingTTLMs,
      // issue in fast-jwt
      // @ts-expect-error - string is accepted
      notBefore: config.jwt.nbfGrace,
    })

    this.#refreshVerifier = createVerifier({
      key: config.jwt.refreshTokenSecret,
    })

    this.#decoder = createDecoder()
  }

  issueTokenPair({ user, family }: IssueTokenPairOptions): TokenPair {
    const accessToken = this.#accessSigner({
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    })

    const refreshToken = this.#refreshSigner({
      sub: user.id,
      family,
      tokenVersion: user.tokenVersion,
    })

    const hashedToken = hashToken(refreshToken)

    return {
      accessToken,
      refreshToken,
      tokenHash: hashedToken,
    }
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.#accessVerifier(token) as AccessTokenPayload
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.#refreshVerifier(token) as RefreshTokenPayload
  }

  decodeToken<T>(token: string): T {
    return this.#decoder(token) as T
  }
}

const plugin = definePlugin(
  {
    name: 'token-service',
  },
  async (app, { config }) => {
    app.decorate('tokenService', new TokenService(config))
  },
)

export default plugin
