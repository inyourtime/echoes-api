import Type from 'typebox'
import { OptionalWithDefault } from '../../plugins/shared-schemas.ts'

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

// YouTube track info
export const YouTubeTrackInfo = Type.Object({
  videoId: Type.String({ description: 'YouTube video ID' }),
  title: Type.String({ description: 'Track title' }),
  artist: Type.String({ description: 'Artist name' }),
})

// YouTube URL query
export const YouTubeTrackQuery = Type.Object({
  url: Type.String({ minLength: 1, description: 'YouTube URL (youtube.com or youtu.be)' }),
})

// YouTube track response
export const YouTubeTrackResponse = Type.Object({
  track: Type.Union([YouTubeTrackInfo, Type.Null()]),
})

// Search response
export const TrackSearchResponse = Type.Object({
  tracks: Type.Array(TrackInfo),
})

// Re-export for convenience
export { TrackInfo }
