import { and, asc, desc, eq, gt, inArray, lt, or, type SQL, sql } from 'drizzle-orm'
import { db } from '#db/index'
import {
  type NewTrack,
  type NewUserTrack,
  type Track,
  type Transaction,
  tags,
  tracks,
  userTracks,
  userTrackTags,
} from '#db/schema'
import { definePlugin } from '#utils/factories'
import { normalizeText } from '#utils/normalize'

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

export interface SearchUserTracksOptions extends ListUserTracksOptions {
  search?: string
  tagIds?: string[]
  artist?: string
  listenedAtFrom?: string
  listenedAtTo?: string
}

export type UserTrackWithTrackAndTags = Awaited<
  ReturnType<
    typeof db.query.userTracks.findMany<{
      with: { track: true; tags: true }
    }>
  >
>[number]

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
    return await db.query.userTracks.findFirst({
      where: { id },
      with: {
        track: true,
        tags: true,
      },
    })
  }

  #buildTsQuery(search: string) {
    const words = search.toLowerCase().split(' ')

    const andQuery = words.map((w) => `${w}:*`).join(' & ')
    const orQuery = words.map((w) => `${w}:*`).join(' | ')

    return { andQuery, orQuery }
  }

  #buildSortAndOrder(sort: 'listenedAt' | 'createdAt', order: 'asc' | 'desc') {
    const sortColumn = sort === 'listenedAt' ? userTracks.listenedAt : userTracks.createdAt
    const orderFn = order === 'desc' ? desc : asc
    const cursorFn = order === 'desc' ? lt : gt
    return { sortColumn, orderFn, cursorFn }
  }

  #buildCursorCondition(
    cursor: string | null | undefined,
    sortColumn: typeof userTracks.listenedAt | typeof userTracks.createdAt,
    cursorFn: typeof lt | typeof gt,
  ) {
    if (!cursor) return undefined
    const decoded = this.#decodeCursor(cursor)
    if (!decoded) return undefined
    const [cursorTimestamp, cursorId] = decoded

    return or(
      cursorFn(sortColumn, cursorTimestamp),
      and(eq(sortColumn, cursorTimestamp), cursorFn(userTracks.id, cursorId)),
    )
  }

  #encodeNextCursor(
    items: UserTrackWithTrackAndTags[],
    hasNextPage: boolean,
    sort: 'listenedAt' | 'createdAt',
  ): string | null {
    if (!hasNextPage) return null
    const lastItem = items.at(-1)
    if (!lastItem) return null
    return this.#encodeCursor(
      sort === 'listenedAt' ? lastItem.listenedAt : lastItem.createdAt,
      lastItem.id,
    )
  }

  async findManyByUserId(options: ListUserTracksOptions): Promise<{
    items: UserTrackWithTrackAndTags[]
    nextCursor: string | null
  }> {
    const { userId, limit, cursor, sort, order } = options
    const { cursorFn } = this.#buildSortAndOrder(sort, order)

    let cursorId: string | undefined
    let cursorTimestamp: Date | undefined

    if (cursor) {
      const decoded = this.#decodeCursor(cursor)
      if (decoded) {
        ;[cursorTimestamp, cursorId] = decoded
      }
    }

    const rows = await db.query.userTracks.findMany({
      where: {
        AND: [
          { userId },
          {
            ...(cursorTimestamp && cursorId
              ? {
                  OR: [
                    {
                      RAW: (t) =>
                        cursorFn(
                          sort === 'listenedAt' ? t.listenedAt : t.createdAt,
                          cursorTimestamp,
                        ),
                    },
                    {
                      AND: [
                        {
                          RAW: (t) =>
                            eq(sort === 'listenedAt' ? t.listenedAt : t.createdAt, cursorTimestamp),
                        },
                        {
                          RAW: (t) => cursorFn(t.id, cursorId),
                        },
                      ],
                    },
                  ],
                }
              : {}),
          },
        ],
      },
      with: {
        track: true,
        tags: true,
      },
      orderBy: {
        [sort]: order,
        id: order,
      },
      limit: limit + 1,
    })

    const hasNextPage = rows.length > limit
    if (hasNextPage) rows.pop()

    const nextCursor = this.#encodeNextCursor(rows, hasNextPage, sort)

    return { items: rows, nextCursor }
  }

  async searchByUserId(options: SearchUserTracksOptions): Promise<{
    items: UserTrackWithTrackAndTags[]
    nextCursor: string | null
  }> {
    const {
      userId,
      limit,
      cursor,
      sort,
      order,
      search,
      tagIds,
      artist,
      listenedAtFrom,
      listenedAtTo,
    } = options
    const { sortColumn, orderFn, cursorFn } = this.#buildSortAndOrder(sort, order)
    const cursorCondition = this.#buildCursorCondition(cursor, sortColumn, cursorFn)

    const whereConditions: (SQL<unknown> | undefined)[] = [eq(userTracks.userId, userId)]
    if (cursorCondition) whereConditions.push(cursorCondition)

    // Tag filter: user track must have AT LEAST ONE of the specified tags
    if (tagIds && tagIds.length > 0) {
      whereConditions.push(
        sql`${userTracks.id} IN (
          SELECT DISTINCT ${userTrackTags.userTrackId}
          FROM ${userTrackTags}
          WHERE ${inArray(userTrackTags.tagId, tagIds)}
        )`,
      )
    }

    // Artist filter: normalize input and match against artistNormalized
    if (artist) {
      const artistNormalized = normalizeText(artist)
      whereConditions.push(eq(tracks.artistNormalized, artistNormalized))
    }

    // ListenedAt date range filter
    if (listenedAtFrom) {
      whereConditions.push(sql`DATE(${userTracks.listenedAt}) >= ${listenedAtFrom}`)
    }
    if (listenedAtTo) {
      whereConditions.push(sql`DATE(${userTracks.listenedAt}) <= ${listenedAtTo}`)
    }

    let andQuery: string | undefined
    let orQuery: string | undefined

    const normalizedSearch = search?.toLowerCase()

    if (search) {
      const built = this.#buildTsQuery(search)
      andQuery = built.andQuery
      orQuery = built.orQuery
    }

    if (search && orQuery) {
      whereConditions.push(
        sql`
          ${tracks.search} @@ to_tsquery('simple', ${orQuery})
        `,
      )
    }

    const rankExpr = sql`
      COALESCE(
        ${
          search && andQuery && orQuery
            ? sql`
          ts_rank(${tracks.search}, to_tsquery('simple', ${andQuery})) * 2 +
          ts_rank(${tracks.search}, to_tsquery('simple', ${orQuery})) +
          CASE
            WHEN ${tracks.artistNormalized} = ${normalizedSearch} THEN 3
            ELSE 0
          END
        `
            : sql`0`
        },
        0
      ) + 
      COALESCE(
        ${
          tagIds && tagIds.length > 0
            ? sql`(
          SELECT COUNT(*)::float
          FROM ${userTrackTags}
          WHERE ${userTrackTags.userTrackId} = ${userTracks.id}
            AND ${inArray(userTrackTags.tagId, tagIds)}
        )`
            : sql`0`
        },
        0
      )
    `

    // Step 1: fetch paged IDs with tracks joined so we can filter/sort on track fields
    const pagedIds = await db
      .select({
        id: userTracks.id,
        rank: rankExpr,
      })
      .from(userTracks)
      .innerJoin(tracks, eq(userTracks.trackId, tracks.id)) // 👈 joined here
      .where(and(...whereConditions))
      .orderBy((t) => {
        return [desc(t.rank), orderFn(sortColumn), orderFn(userTracks.id)]
      })
      .limit(limit + 1)

    if (pagedIds.length === 0) {
      return { items: [], nextCursor: null }
    }

    const hasNextPage = pagedIds.length > limit
    if (hasNextPage) pagedIds.pop()
    const ids = pagedIds.map((r) => r.id)

    // Step 2: fetch full data for those IDs with tags joined
    const rows = await db
      .select({
        userTrack: userTracks,
        track: tracks,
        tag: tags,
      })
      .from(userTracks)
      .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
      .leftJoin(userTrackTags, eq(userTracks.id, userTrackTags.userTrackId))
      .leftJoin(tags, eq(userTrackTags.tagId, tags.id))
      .where(inArray(userTracks.id, ids))

    // Step 3: group by userTrack id
    const map = new Map<string, UserTrackWithTrackAndTags>()
    for (const row of rows) {
      if (!map.has(row.userTrack.id)) {
        map.set(row.userTrack.id, {
          ...row.userTrack,
          track: row.track,
          tags: [],
        })
      }
      if (row.tag) {
        map.get(row.userTrack.id)!.tags.push(row.tag)
      }
    }

    // Preserve original sort order from step 1
    const items = ids.map((id) => map.get(id)!).filter(Boolean)

    const nextCursor = this.#encodeNextCursor(items, hasNextPage, sort)

    return { items, nextCursor }
  }

  async findByUserIdAndTrackIdOnSameDay(userId: string, trackId: string, listenedAt: Date) {
    return db.query.userTracks.findFirst({
      where: {
        userId,
        trackId,
        RAW: (t) => sql`DATE(${t.listenedAt}) = DATE(${listenedAt})`,
      },
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
