import { and, eq, isNull, lt } from 'drizzle-orm'
import { definePlugin } from '#utils/factories'
import { db } from '../../db/index.ts'
import {
  type NewVerificationToken,
  type VerificationTokenType,
  verificationTokens,
} from '../../db/schema/index.ts'

declare module 'fastify' {
  interface FastifyInstance {
    verificationTokenRepository: VerificationTokenRepository
  }
}

export class VerificationTokenRepository {
  async create(token: NewVerificationToken) {
    return (await db.insert(verificationTokens).values(token).returning())[0]
  }

  async findByTokenHash(tokenHash: string) {
    return db.query.verificationTokens.findFirst({
      where: eq(verificationTokens.tokenHash, tokenHash),
      with: {
        user: true,
      },
    })
  }

  async findUnusedByUserAndType(userId: string, type: VerificationTokenType) {
    return db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.type, type),
        isNull(verificationTokens.usedAt),
      ),
    })
  }

  async markAsUsed(id: string) {
    return db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, id))
  }

  async deleteExpired() {
    return db.delete(verificationTokens).where(lt(verificationTokens.expiresAt, new Date()))
  }

  async deleteByUserAndType(userId: string, type: VerificationTokenType) {
    return db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, type)))
  }
}

const plugin = definePlugin(
  {
    name: 'verification-token-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('verificationTokenRepository', new VerificationTokenRepository())
  },
)

export default plugin
