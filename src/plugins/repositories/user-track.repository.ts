import { and, asc, desc, eq, gt, inArray, lt, or, type SQL, sql } from 'drizzle-orm'
import { db, type InferQueryResult } from '../../db/index.ts'
import {
  type NewTrack,
  type NewUserTrack,
  type Tag,
  type Track,
  type Transaction,
  tags,
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
  cursor?: string | null // cursor-based pagination (listenedAt_timestamp:id)
  sort: 'listenedAt' | 'createdAt'
  order: 'asc' | 'desc'
}

export interface UserTrackWithTrackAndTags
  extends InferQueryResult<'userTracks', { with: { track: true } }> {
  tags: Array<Tag>
}

export class UserTrackRepository {
  #encodeCursor(timestamp: Date, id: string): string {
    const raw = `${timestamp.toISOString()}|${id}`
    return Buffer.from(raw).toString('base64url')
  }

  #decodeCursor(cursor: string): [Date, string] | null {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf-8')
      const parts = raw.split('|')

      if (parts.length !== 2) return null

      const [timestamp, id] = parts
      if (!timestamp || !id) return null

      return [new Date(timestamp), id]
    } catch {
      return null
    }
  }

  async findById(id: string) {
    const result = await db.query.userTracks.findFirst({
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

    return result
      ? {
          ...result,
          tags: result.userTrackTags.map((t) => t.tag),
        }
      : undefined
  }

  // No change needed to decodeCursor

  async findManyByUserId(options: ListUserTracksOptions): Promise<{
    items: UserTrackWithTrackAndTags[]
    nextCursor: string | null
  }> {
    const { userId, limit, cursor, sort, order } = options

    const sortColumn = sort === 'listenedAt' ? userTracks.listenedAt : userTracks.createdAt
    const orderFn = order === 'desc' ? desc : asc
    const cursorFn = order === 'desc' ? lt : gt

    let cursorCondition: SQL<unknown> | undefined
    if (cursor) {
      const decoded = this.#decodeCursor(cursor)
      if (decoded) {
        const [cursorTimestamp, cursorId] = decoded
        cursorCondition = or(
          cursorFn(sortColumn, cursorTimestamp),
          and(eq(sortColumn, cursorTimestamp), cursorFn(userTracks.id, cursorId)),
        )
      }
    }

    const whereConditions: (SQL<unknown> | undefined)[] = [eq(userTracks.userId, userId)]
    if (cursorCondition) whereConditions.push(cursorCondition)

    const pagedUserTracks = db
      .select()
      .from(userTracks)
      .where(and(...whereConditions))
      .limit(limit + 1)
      .orderBy(orderFn(sortColumn), orderFn(userTracks.id))
      .as('paged_user_tracks')

    const pagedSortColumn =
      sort === 'listenedAt' ? pagedUserTracks.listenedAt : pagedUserTracks.createdAt

    const rows = await db
      .select()
      .from(pagedUserTracks)
      .innerJoin(tracks, eq(pagedUserTracks.trackId, tracks.id))
      .leftJoin(userTrackTags, eq(pagedUserTracks.id, userTrackTags.userTrackId))
      .leftJoin(tags, eq(userTrackTags.tagId, tags.id))
      .orderBy(orderFn(pagedSortColumn), orderFn(pagedUserTracks.id))

    // group by userTrack id
    const map = new Map<string, UserTrackWithTrackAndTags>()
    for (const row of rows) {
      if (!map.has(row.paged_user_tracks.id)) {
        map.set(row.paged_user_tracks.id, {
          ...row.paged_user_tracks,
          track: row.tracks,
          tags: [],
        })
      }
      if (row.tags) {
        map.get(row.paged_user_tracks.id)!.tags.push(row.tags)
      }
    }

    const items = [...map.values()]

    const hasNextPage = items.length > limit
    if (hasNextPage) items.pop() // remove the extra item in place

    const lastItem = items.at(-1)
    const nextCursor =
      hasNextPage && lastItem
        ? this.#encodeCursor(
            sort === 'listenedAt' ? lastItem.listenedAt : lastItem.createdAt,
            lastItem.id,
          )
        : null

    return {
      items,
      nextCursor,
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
    const currentTagIds = old.tags.map((t) => t.id)
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
      if (Object.keys(updates).length > 0) {
        await tx.update(userTracks).set(updates).where(eq(userTracks.id, old.id))
      }

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
