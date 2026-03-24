import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { type NewTrack, tracks } from '../../db/schema/index.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    trackRepository: TrackRepository
  }
}

export class TrackRepository {
  async findById(id: string) {
    return db.query.tracks.findFirst({
      where: eq(tracks.id, id),
    })
  }

  async findBySpotifyId(spotifyTrackId: string) {
    return db.query.tracks.findFirst({
      where: and(eq(tracks.spotifyTrackId, spotifyTrackId), eq(tracks.source, 'spotify')),
    })
  }

  async findByNormalizedTitleArtist(titleNormalized: string, artistNormalized: string) {
    return db.query.tracks.findFirst({
      where: and(
        eq(tracks.titleNormalized, titleNormalized),
        eq(tracks.artistNormalized, artistNormalized),
        eq(tracks.source, 'manual'),
      ),
    })
  }

  async create(track: NewTrack) {
    return (await db.insert(tracks).values(track).returning())[0]
  }
}

const plugin = definePlugin(
  {
    name: 'track-repository',
    dependencies: ['db'],
  },
  async (app) => {
    app.decorate('trackRepository', new TrackRepository())
  },
)

export default plugin
