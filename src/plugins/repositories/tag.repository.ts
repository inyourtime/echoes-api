import { eq } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewTag, tags } from '../../db/schema.ts'
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
      where: { id },
    })
  }

  async findByUserId(options: ListTagsOptions) {
    return db.query.tags.findMany({
      where: { userId: options.userId },
      orderBy: {
        name: 'asc',
      },
    })
  }

  async findByName(userId: string, name: string) {
    return db.query.tags.findFirst({
      where: { userId, name },
    })
  }

  async create(tag: NewTag) {
    return (await db.insert(tags).values(tag).returning())[0]
  }

  async update(id: string, updates: Partial<NewTag>) {
    return (await db.update(tags).set(updates).where(eq(tags.id, id)).returning())[0]
  }

  async delete(id: string) {
    await db.delete(tags).where(eq(tags.id, id))
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
