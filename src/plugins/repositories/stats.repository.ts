import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '#db/index'
import { tags, tracks, userTracks, userTrackTags } from '#db/schema/index'
import { definePlugin } from '#utils/factories'

declare module 'fastify' {
  interface FastifyInstance {
    statsRepository: StatsRepository
  }
}

export interface TopArtist {
  artist: string
  count: number
}

export interface MonthlyActivity {
  month: string
  count: number
}

export interface TagDistribution {
  tagId: string
  name: string
  color: string | null
  count: number
  percentage: number
}

export interface OverviewStats {
  totalTracks: number
  totalArtists: number
  uniqueTagsUsed: number
  thisMonthCount: number
}

export class StatsRepository {
  async getTopArtists(userId: string, limit: number = 10): Promise<TopArtist[]> {
    const results = await db
      .select({
        artist: sql<string>`min(${tracks.artist})`,
        artistNormalized: tracks.artistNormalized,
        count: count(),
      })
      .from(userTracks)
      .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
      .where(eq(userTracks.userId, userId))
      .groupBy(tracks.artistNormalized)
      .orderBy(desc(count()))
      .limit(limit)

    return results.map((r) => ({
      artist: r.artist,
      count: Number(r.count),
    }))
  }

  async getMonthlyActivity(userId: string, months: number = 12): Promise<MonthlyActivity[]> {
    // Get activity for the last N months
    const results = await db
      .select({
        month: sql<string>`TO_CHAR(${userTracks.listenedAt}, 'YYYY-MM')`,
        count: count(),
      })
      .from(userTracks)
      .where(
        and(
          eq(userTracks.userId, userId),
          sql`${userTracks.listenedAt} >= NOW() - ${sql.raw(`INTERVAL '${months} months'`)}`,
        ),
      )
      .groupBy(sql`TO_CHAR(${userTracks.listenedAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${userTracks.listenedAt}, 'YYYY-MM')`)

    return results.map((r) => ({
      month: r.month,
      count: Number(r.count),
    }))
  }

  async getTagDistribution(userId: string): Promise<TagDistribution[]> {
    // Get total tagged entries count for percentage calculation
    const [{ total }] = await db
      .select({
        total: count(),
      })
      .from(userTrackTags)
      .innerJoin(userTracks, eq(userTrackTags.userTrackId, userTracks.id))
      .where(eq(userTracks.userId, userId))

    if (total === 0) {
      return []
    }

    const results = await db
      .select({
        tagId: tags.id,
        name: tags.name,
        color: tags.color,
        count: count(),
      })
      .from(userTrackTags)
      .innerJoin(tags, eq(userTrackTags.tagId, tags.id))
      .innerJoin(userTracks, eq(userTrackTags.userTrackId, userTracks.id))
      .where(eq(tags.userId, userId))
      .groupBy(tags.id, tags.name, tags.color)
      .orderBy(desc(count()))

    return results.map((r) => ({
      tagId: r.tagId,
      name: r.name,
      color: r.color,
      count: Number(r.count),
      percentage: Math.round((Number(r.count) / Number(total)) * 100),
    }))
  }

  async getOverview(userId: string): Promise<OverviewStats> {
    // Total tracks
    const [{ totalTracks }] = await db
      .select({ totalTracks: count() })
      .from(userTracks)
      .where(eq(userTracks.userId, userId))

    // Unique artists
    const [{ uniqueArtists }] = await db
      .select({ uniqueArtists: count(sql`DISTINCT ${tracks.artist}`) })
      .from(userTracks)
      .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
      .where(eq(userTracks.userId, userId))

    // Tags used count
    const [{ tagsUsed }] = await db
      .select({ tagsUsed: count(sql`DISTINCT ${tags.id}`) })
      .from(userTrackTags)
      .innerJoin(userTracks, eq(userTrackTags.userTrackId, userTracks.id))
      .innerJoin(tags, eq(userTrackTags.tagId, tags.id))
      .where(eq(tags.userId, userId))

    // This month's count
    const [{ thisMonthCount }] = await db
      .select({ thisMonthCount: count() })
      .from(userTracks)
      .where(
        and(
          eq(userTracks.userId, userId),
          sql`DATE_TRUNC('month', ${userTracks.listenedAt}) = DATE_TRUNC('month', NOW())`,
        ),
      )

    return {
      totalTracks: Number(totalTracks),
      totalArtists: Number(uniqueArtists),
      uniqueTagsUsed: Number(tagsUsed),
      thisMonthCount: Number(thisMonthCount),
    }
  }
}

const plugin = definePlugin(
  {
    name: 'stats-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('statsRepository', new StatsRepository())
  },
)

export default plugin
