import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewUserTrackTag, userTrackTags } from '../../db/schema/index.ts'
import { definePlugin } from '../../utils/factories.ts'

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

  async setTags(userTrackId: string, tagIds: string[]) {
    // Get current tags
    const currentTags = await this.findByUserTrackId(userTrackId)
    const currentTagIds = currentTags.map((t) => t.tagId)

    // Tags to add
    const toAdd = tagIds.filter((id) => !currentTagIds.includes(id))
    // Tags to remove
    const toRemove = currentTagIds.filter((id) => !tagIds.includes(id))

    // Batch add new tags
    if (toAdd.length > 0) {
      await db.insert(userTrackTags).values(toAdd.map((tagId) => ({ userTrackId, tagId })))
    }

    // Batch remove old tags
    if (toRemove.length > 0) {
      await db
        .delete(userTrackTags)
        .where(
          and(eq(userTrackTags.userTrackId, userTrackId), inArray(userTrackTags.tagId, toRemove)),
        )
    }

    return this.findByUserTrackId(userTrackId)
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
