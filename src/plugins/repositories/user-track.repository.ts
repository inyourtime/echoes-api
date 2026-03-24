import { asc, count, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewUserTrack, userTracks } from '../../db/schema/index.ts'
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
      },
    })

    return {
      items,
      total: countResult.count,
    }
  }

  async create(userTrack: NewUserTrack) {
    return (await db.insert(userTracks).values(userTrack).returning())[0]
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
