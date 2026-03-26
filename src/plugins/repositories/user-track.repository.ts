import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, type InferQueryResult } from '../../db/index.ts'
import {
  type NewTrack,
  type NewUserTrack,
  type Track,
  type Transaction,
  tracks,
  userTracks,
  userTrackTags,
} from '../../db/schema/index.ts'
import { definePlugin } from '../../utils/factories.ts'
import { normalizeText } from '../../utils/normalize.ts'

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

export type UserTrackWithTrackAndTags = InferQueryResult<
  'userTracks',
  { with: { track: true; userTrackTags: { with: { tag: true } } } }
>

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

  #buildTrackInsert(patch: Partial<NewTrack>, old: Track): NewTrack {
    const title = patch.title ?? old.title
    const artist = patch.artist ?? old.artist
    return {
      source: 'manual',
      title,
      artist,
      titleNormalized: normalizeText(title),
      artistNormalized: normalizeText(artist),
    }
  }

  async #syncTags(tx: Transaction, old: UserTrackWithTrackAndTags, tagIds: string[]) {
    const currentTagIds = old.userTrackTags.map((t) => t.tagId)
    const toAdd = tagIds.filter((id) => !currentTagIds.includes(id))
    const toRemove = currentTagIds.filter((id) => !tagIds.includes(id))

    if (toAdd.length > 0)
      await tx.insert(userTrackTags).values(toAdd.map((tagId) => ({ userTrackId: old.id, tagId })))

    if (toRemove.length > 0)
      await tx
        .delete(userTrackTags)
        .where(and(eq(userTrackTags.userTrackId, old.id), inArray(userTrackTags.tagId, toRemove)))
  }

  async updateTrackAndTags(
    old: UserTrackWithTrackAndTags,
    userTrackPatch: Partial<NewUserTrack>,
    trackPatch: Partial<NewTrack> | undefined,
    tagIds: string[] | undefined,
  ) {
    return db.transaction(async (tx) => {
      const updates: Partial<NewUserTrack> = {}

      // 1. Upsert track if patch provided
      if (trackPatch && Object.keys(trackPatch).length > 0) {
        const [track] = await tx
          .insert(tracks)
          .values(this.#buildTrackInsert(trackPatch, old.track))
          .onConflictDoUpdate({
            target: [tracks.titleNormalized, tracks.artistNormalized],
            set: { updatedAt: new Date() },
          })
          .returning()

        updates.trackId = track.id
      }

      // 2. Copy scalar fields from patch
      for (const [key, value] of Object.entries(userTrackPatch)) {
        if (value !== undefined) (updates as any)[key] = value
      }

      // 3. Persist if anything changed
      if (Object.keys(updates).length > 0)
        await tx.update(userTracks).set(updates).where(eq(userTracks.id, old.id))

      // 4. Sync tags (all inside tx)
      if (tagIds !== undefined) await this.#syncTags(tx, old, tagIds)
    })
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
