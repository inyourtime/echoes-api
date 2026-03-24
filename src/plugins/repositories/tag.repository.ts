import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewTag, tags } from '../../db/schema/index.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    tagRepository: TagRepository
  }
}

export interface ListTagsOptions {
  userId: string
}

export class TagRepository {
  async findById(id: string) {
    return db.query.tags.findFirst({
      where: eq(tags.id, id),
    })
  }

  async findByUserId(options: ListTagsOptions) {
    return db.query.tags.findMany({
      where: eq(tags.userId, options.userId),
      orderBy: tags.name,
    })
  }

  async findByName(userId: string, name: string) {
    return db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), eq(tags.name, name)),
    })
  }

  async create(tag: NewTag) {
    return (await db.insert(tags).values(tag).returning())[0]
  }

  async update(id: string, updates: Partial<NewTag>) {
    return (
      await db.update(tags).set(updates).where(eq(tags.id, id)).returning()
    )[0]
  }

  async delete(id: string) {
    await db.delete(tags).where(eq(tags.id, id))
  }

  async existsOtherWithName(userId: string, name: string, excludeId: string) {
    const result = await db.query.tags.findFirst({
      where: and(
        eq(tags.userId, userId),
        eq(tags.name, name),
        ne(tags.id, excludeId),
      ),
    })
    return !!result
  }
}

const plugin = definePlugin(
  {
    name: 'tag-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('tagRepository', new TagRepository())
  },
)

export default plugin
