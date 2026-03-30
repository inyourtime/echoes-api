import { and, eq } from 'drizzle-orm'
import { db } from '#db/index'
import { type NewUserTrackTag, userTrackTags } from '#db/schema/index'
import { definePlugin } from '#utils/factories'

declare module 'fastify' {
  interface FastifyInstance {
    userTrackTagRepository: UserTrackTagRepository
  }
}

export class UserTrackTagRepository {
  async findByUserTrackId(userTrackId: string) {
    return db.query.userTrackTags.findMany({
      where: eq(userTrackTags.userTrackId, userTrackId),
      with: {
        tag: true,
      },
    })
  }

  async findByIds(userTrackId: string, tagId: string) {
    return db.query.userTrackTags.findFirst({
      where: and(eq(userTrackTags.userTrackId, userTrackId), eq(userTrackTags.tagId, tagId)),
    })
  }

  async create(data: NewUserTrackTag) {
    return (await db.insert(userTrackTags).values(data).returning())[0]
  }

  async delete(userTrackId: string, tagId: string) {
    await db
      .delete(userTrackTags)
      .where(and(eq(userTrackTags.userTrackId, userTrackId), eq(userTrackTags.tagId, tagId)))
  }

  async deleteAllByUserTrackId(userTrackId: string) {
    await db.delete(userTrackTags).where(eq(userTrackTags.userTrackId, userTrackId))
  }
}

const plugin = definePlugin(
  {
    name: 'user-track-tag-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('userTrackTagRepository', new UserTrackTagRepository())
  },
)

export default plugin
