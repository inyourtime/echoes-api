import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewPushToken, pushTokens } from '../../db/schema.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    pushTokenRepository: PushTokenRepository
  }
}

export class PushTokenRepository {
  async createOrUpdate(pushToken: NewPushToken) {
    const [record] = await db
      .insert(pushTokens)
      .values(pushToken)
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId: pushToken.userId,
          platform: pushToken.platform,
          userAgent: pushToken.userAgent ?? null,
          lastRegisteredAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    return record
  }

  async findByUserId(userId: string) {
    return db.query.pushTokens.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findByUserIdAndToken(userId: string, token: string) {
    return db.query.pushTokens.findFirst({
      where: { token, userId },
    })
  }

  async deleteByUserIdAndToken(userId: string, token: string) {
    return db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
      .returning()
  }

  async deleteByTokens(tokens: string[]) {
    if (tokens.length === 0) {
      return []
    }

    return db.delete(pushTokens).where(inArray(pushTokens.token, tokens)).returning()
  }
}

const plugin = definePlugin(
  {
    name: 'push-token-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('pushTokenRepository', new PushTokenRepository())
  },
)

export default plugin
