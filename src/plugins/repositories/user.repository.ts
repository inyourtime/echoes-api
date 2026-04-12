import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewUser, users } from '../../db/schema.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    userRepository: UserRepository
  }
}

export class UserRepository {
  async create(user: NewUser) {
    return (await db.insert(users).values(user).returning())[0]
  }

  async findById(id: string) {
    return db.query.users.findFirst({
      where: { id },
      columns: {
        passwordHash: false,
      },
    })
  }

  async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: { email },
    })
  }

  async verifyEmail(id: string) {
    return db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, id)).returning()
  }

  async updatePassword(id: string, passwordHash: string) {
    return db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, id))
      .returning()
  }
}

const plugin = definePlugin(
  {
    name: 'user-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('userRepository', new UserRepository())
  },
)

export default plugin
