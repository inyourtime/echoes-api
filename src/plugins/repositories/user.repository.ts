import { eq } from 'drizzle-orm'
import { db } from '#db/index'
import { type NewUser, users } from '#db/schema'
import { definePlugin } from '#utils/factories'

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
