import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewUserTrack, userTracks, userTrackTags } from '../../db/schema/index.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    userTrackRepository: UserTrackRepository
  }
}

export interface ListUserTracksOptions {
  userId: string
  limit: number
  offset: number
  sort: 'listenedAt' | 'createdAt'
  order: 'asc' | 'desc'
}

export class UserTrackRepository {
  async findById(id: string) {
    return db.query.userTracks.findFirst({
      where: eq(userTracks.id, id),
      with: {
        track: true,
        userTrackTags: {
          with: {
            tag: true,
          },
        },
      },
    })
  }

  async findManyByUserId(options: ListUserTracksOptions) {
    const { userId, limit, offset, sort, order } = options

    // Build order by clause
    const sortColumn = sort === 'listenedAt' ? userTracks.listenedAt : userTracks.createdAt
    const orderFn = order === 'desc' ? desc : asc

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(userTracks)
      .where(eq(userTracks.userId, userId))

    // Get paginated items
    const items = await db.query.userTracks.findMany({
      where: eq(userTracks.userId, userId),
      orderBy: orderFn(sortColumn),
      limit,
      offset,
      with: {
        track: true,
        userTrackTags: {
          with: {
            tag: true,
          },
        },
      },
    })

    return {
      items,
      total: countResult.count,
    }
  }

  async findByUserIdAndTrackIdOnSameDay(userId: string, trackId: string, listenedAt: Date) {
    const listenedAtDate = sql`DATE(${listenedAt})`
    return db.query.userTracks.findFirst({
      where: and(
        eq(userTracks.userId, userId),
        eq(userTracks.trackId, trackId),
        sql`DATE(${userTracks.listenedAt}) = ${listenedAtDate}`,
      ),
    })
  }

  async create(userTrack: NewUserTrack) {
    return (await db.insert(userTracks).values(userTrack).returning())[0]
  }

  async createWithTags(userTrack: NewUserTrack, tagIds: string[] | undefined) {
    return db.transaction(async (tx) => {
      // 1. Create userTrack
      const [userTrackReturn] = await tx.insert(userTracks).values(userTrack).returning()

      // 2. Insert tags (bulk is better 👇)
      if (tagIds && tagIds.length > 0) {
        await tx.insert(userTrackTags).values(
          tagIds.map((tagId) => ({
            userTrackId: userTrackReturn.id,
            tagId,
          })),
        )
      }

      return userTrackReturn
    })
  }

  async update(id: string, updates: Partial<NewUserTrack>) {
    return (await db.update(userTracks).set(updates).where(eq(userTracks.id, id)).returning())[0]
  }

  async delete(id: string) {
    await db.delete(userTracks).where(eq(userTracks.id, id))
  }
}

const plugin = definePlugin(
  {
    name: 'user-track-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('userTrackRepository', new UserTrackRepository())
  },
)

export default plugin
