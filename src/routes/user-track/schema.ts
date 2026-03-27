import Type from 'typebox'
import { TDate } from '../../plugins/shared-schemas.ts'

// Manual track input (when not using externalId)
const TrackInput = Type.Object(
  {
    title: Type.String({ minLength: 1, description: 'Track title' }),
    artist: Type.String({ minLength: 1, description: 'Artist name' }),
  },
  { description: 'Track information' },
)

// Create user track request body - supports both manual and external modes
export const CreateUserTrackBody = Type.Object({
  // Either provide externalId OR manual track info
  externalId: Type.Optional(
    Type.String({ description: 'External track ID if source is external' }),
  ),
  track: TrackInput,

  // User context fields
  note: Type.Optional(Type.String({ description: 'Personal note about this track' })),
  youtubeUrl: Type.Optional(
    Type.String({ format: 'uri', description: 'YouTube URL for this track' }),
  ),
  listenedAt: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'When the user listened to this track (ISO 8601)',
    }),
  ),
  tagIds: Type.Optional(
    Type.Array(Type.String({ format: 'uuid' }), {
      maxItems: 10,
      description: 'Tag IDs to attach to this user track',
    }),
  ),
})

// Tag info
const TagInfo = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  name: Type.String(),
  color: Type.Union([Type.String(), Type.Null()]),
  createdAt: TDate,
})

// Track info in response
const TrackInfo = Type.Object({
  id: Type.String({ format: 'uuid' }),
  source: Type.Union([
    Type.Literal('spotify'),
    Type.Literal('manual'),
    Type.Literal('apple-music'),
  ]),
  externalId: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  artist: Type.String(),
})

// User track response
const UserTrackInfo = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  trackId: Type.String({ format: 'uuid' }),
  note: Type.Union([Type.String(), Type.Null()]),
  youtubeUrl: Type.Union([Type.String(), Type.Null()]),
  listenedAt: TDate,
  createdAt: TDate,
  updatedAt: TDate,
})

// User track with track and tags
const UserTrackWithTrackAndTags = Type.Object({
  ...UserTrackInfo.properties,
  track: TrackInfo,
  tags: Type.Array(TagInfo),
})

// Create response
export const CreateUserTrackResponse = Type.Object({
  userTrack: UserTrackWithTrackAndTags,
})

// ═══════════════════════════════════════════════════════════════════════════════
// LIST USER TRACKS SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Query parameters for listing user tracks
export const ListUserTracksQuery = Type.Object(
  {
    limit: Type.Optional(
      Type.Integer({
        default: 20,
        minimum: 1,
        maximum: 100,
        description: 'Number of items to return per page',
      }),
    ),
    offset: Type.Optional(
      Type.Integer({
        default: 0,
        minimum: 0,
        description: 'Number of items to skip',
      }),
    ),
    sort: Type.Optional(
      Type.Union([Type.Literal('listenedAt'), Type.Literal('createdAt')], {
        default: 'listenedAt',
        description: 'Field to sort by',
      }),
    ),
    order: Type.Optional(
      Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        default: 'desc',
        description: 'Sort order',
      }),
    ),
  },
  { description: 'Query parameters for paginated user track list' },
)

// Pagination metadata
const PaginationMeta = Type.Object({
  total: Type.Integer({ description: 'Total number of items' }),
  limit: Type.Integer({ description: 'Items per page' }),
  offset: Type.Integer({ description: 'Current offset' }),
  hasMore: Type.Boolean({ description: 'Whether there are more items' }),
})

// List response with pagination
export const ListUserTracksResponse = Type.Object({
  userTracks: Type.Array(UserTrackWithTrackAndTags),
  meta: PaginationMeta,
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET SINGLE USER TRACK SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Single user track response
export const GetUserTrackResponse = Type.Object({
  userTrack: UserTrackWithTrackAndTags,
})

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE USER TRACK SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Update user track request body (all fields optional)
export const UpdateUserTrackBody = Type.Object({
  track: Type.Optional(
    Type.Object({
      title: Type.Optional(Type.String()),
      artist: Type.Optional(Type.String()),
    }),
  ),
  note: Type.Optional(
    Type.Union([Type.String(), Type.Null()], {
      description: 'Personal note about this track (null to clear)',
    }),
  ),
  youtubeUrl: Type.Optional(
    Type.Union([Type.String(), Type.Null()], {
      description: 'YouTube URL for this track (null to clear)',
    }),
  ),
  listenedAt: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'When the user listened to this track (ISO 8601)',
    }),
  ),
  tagIds: Type.Optional(
    Type.Array(Type.String({ format: 'uuid' }), {
      description: 'Replace all tags with these IDs (empty array to clear all)',
    }),
  ),
})

// Update response (same as get response)
export const UpdateUserTrackResponse = GetUserTrackResponse
