import Type from 'typebox'
import { OptionalWithDefault } from '#plugins/shared-schemas'

// Track search query
export const TrackSearchQuery = Type.Object({
  q: Type.String({ minLength: 1, description: 'Search query for tracks' }),
  limit: OptionalWithDefault(Type.Number(), {
    default: 10,
    maximum: 20,
    description: 'Maximum number of results',
  }),
})

// Track info from Apple Music search
const TrackInfo = Type.Object({
  trackId: Type.String({ description: 'Apple Music track ID' }),
  title: Type.String({ description: 'Track title' }),
  artist: Type.String({ description: 'Artist name' }),
})

// Search response
export const TrackSearchResponse = Type.Object({
  tracks: Type.Array(TrackInfo),
})
