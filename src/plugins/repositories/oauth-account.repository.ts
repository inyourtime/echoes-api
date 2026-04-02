import { eq } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewOauthAccount, type OauthProvider, oauthAccounts } from '../../db/schema.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    oauthAccountRepository: OauthAccountRepository
  }
}

export class OauthAccountRepository {
  async findByProviderAndAccountId(provider: OauthProvider, providerAccountId: string) {
    return db.query.oauthAccounts.findFirst({
      where: {
        provider,
        providerAccountId,
      },
      with: {
        user: true,
      },
    })
  }

  async findByUserAndProvider(userId: string, provider: OauthProvider) {
    return db.query.oauthAccounts.findFirst({
      where: {
        userId,
        provider,
      },
    })
  }

  async create(oauthAccount: NewOauthAccount) {
    return (await db.insert(oauthAccounts).values(oauthAccount).returning())[0]
  }

  async updateTokens(
    id: string,
    tokens: {
      accessToken: string
      refreshToken?: string
      tokenExpiresAt?: Date
      scope?: string
    },
  ) {
    return db
      .update(oauthAccounts)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
        scope: tokens.scope,
        updatedAt: new Date(),
      })
      .where(eq(oauthAccounts.id, id))
  }
}

const plugin = definePlugin(
  {
    name: 'oauth-account-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('oauthAccountRepository', new OauthAccountRepository())
  },
)

export default plugin
