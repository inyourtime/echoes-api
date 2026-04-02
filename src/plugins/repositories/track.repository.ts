import { db } from '../../db/index.ts'
import { type NewTrack, tracks } from '../../db/schema.ts'
import { definePlugin } from '../../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    trackRepository: TrackRepository
  }
}

export class TrackRepository {
  async findById(id: string) {
    return db.query.tracks.findFirst({
      where: { id },
    })
  }

  async findByExternalId(externalId: string) {
    return db.query.tracks.findFirst({
      where: { externalId },
    })
  }

  async findByNormalizedTitleArtist(titleNormalized: string, artistNormalized: string) {
    return db.query.tracks.findFirst({
      where: {
        titleNormalized,
        artistNormalized,
      },
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
