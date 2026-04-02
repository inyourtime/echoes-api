import { defineRoute } from '../../utils/factories.ts'
import { TrackSearchQuery, TrackSearchResponse } from './schema.ts'

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

interface iTunesTrackResult {
  trackId: number
  trackName: string
  artistName: string
}

interface iTunesSearchResponse {
  results: iTunesTrackResult[]
}

const route = defineRoute(
  {
    prefix: '/tracks',
    tags: ['Track'],
  },
  async (app) => {
    app.get(
      '/search',
      {
        config: { auth: true },
        schema: {
          summary: 'Search tracks from Apple Music',
          description: 'Search for tracks using Apple Music (iTunes) API',
          querystring: TrackSearchQuery,
          response: {
            200: TrackSearchResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          },
        },
      },
      async (request, reply) => {
        const { q, limit } = request.query

        // Build iTunes API URL
        const params = new URLSearchParams({
          term: q,
          media: 'music',
          entity: 'song',
          limit: String(limit),
        })

        const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`)

        if (!response.ok) {
          throw app.httpErrors.internalServerError('Failed to fetch from Apple Music')
        }

        const data = (await response.json()) as iTunesSearchResponse

        // Deduplicate by title + artist (case-insensitive)
        const seen = new Set<string>()
        const tracks = data.results
          .filter((item) => {
            const key = `${item.trackName.toLowerCase().trim()}-${item.artistName.toLowerCase().trim()}`
            if (seen.has(key)) {
              return false
            }
            seen.add(key)
            return true
          })
          .map((item) => ({
            trackId: String(item.trackId),
            title: item.trackName,
            artist: item.artistName,
          }))

        return reply.send({ tracks })
      },
    )
  },
)

export default route
