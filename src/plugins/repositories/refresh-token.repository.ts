import { eq } from 'drizzle-orm'
import { db } from '#db/index'
import { type NewRefreshToken, type RefreshToken, refreshTokens } from '#db/schema/index'
import { definePlugin } from '#utils/factories'

declare module 'fastify' {
  interface FastifyInstance {
    refreshTokenRepository: RefreshTokenRepository
  }
}

export class RefreshTokenRepository {
  async createOrUpdate(refreshToken: NewRefreshToken | RefreshToken) {
    await db
      .insert(refreshTokens)
      .values(refreshToken)
      .onConflictDoUpdate({
        target: refreshTokens.family,
        set: {
          expiresAt: refreshToken.expiresAt,
          tokenVersion: refreshToken.tokenVersion,
          lastUsedAt: new Date(),
          ipAddress: refreshToken.ipAddress,
          userAgent: refreshToken.userAgent ?? null,
          tokenHash: refreshToken.tokenHash,
        },
      })
  }

  findByFamily(family: string) {
    return db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.family, family),
      with: {
        user: true,
      },
    })
  }

  deleteByFamily(family: string) {
    return db.delete(refreshTokens).where(eq(refreshTokens.family, family))
  }
}

const plugin = definePlugin(
  {
    name: 'refresh-token-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('refreshTokenRepository', new RefreshTokenRepository())
  },
)

export default plugin
