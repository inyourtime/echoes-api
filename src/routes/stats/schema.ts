import Type from 'typebox'
import { OptionalWithDefault } from '../../plugins/shared-schemas.ts'

// Top Artists
export const TopArtistItem = Type.Object({
  artist: Type.String({ description: 'Artist name' }),
  count: Type.Integer({ description: 'Number of tracks saved' }),
})

export const TopArtistsQuery = Type.Object({
  limit: OptionalWithDefault(Type.Integer(), {
    default: 10,
    minimum: 1,
    maximum: 50,
    description: 'Number of top artists to return',
  }),
})

export const TopArtistsResponse = Type.Object({
  artists: Type.Array(TopArtistItem),
})

// Monthly Activity
export const MonthlyActivityItem = Type.Object({
  month: Type.String({ description: 'Month in YYYY-MM format' }),
  count: Type.Integer({ description: 'Number of tracks saved in this month' }),
})

export const MonthlyActivityQuery = Type.Object({
  months: OptionalWithDefault(Type.Integer(), {
    default: 12,
    minimum: 1,
    maximum: 24,
    description: 'Number of months to look back',
  }),
})

export const MonthlyActivityResponse = Type.Object({
  activity: Type.Array(MonthlyActivityItem),
})

// Tag Distribution
export const TagDistributionItem = Type.Object({
  tagId: Type.String({ format: 'uuid', description: 'Tag ID' }),
  name: Type.String({ description: 'Tag name' }),
  color: Type.Optional(Type.String({ description: 'Tag color hex code' })),
  count: Type.Integer({ description: 'Number of entries with this tag' }),
  percentage: Type.Integer({ description: 'Percentage of total tagged entries (0-100)' }),
})

export const TagDistributionResponse = Type.Object({
  distribution: Type.Array(TagDistributionItem),
  totalTagged: Type.Integer({ description: 'Total number of tagged entries' }),
})

// Overview Stats
export const OverviewStatsResponse = Type.Object({
  totalTracks: Type.Integer({ description: 'Total number of tracks saved' }),
  totalArtists: Type.Integer({ description: 'Number of unique artists' }),
  uniqueTagsUsed: Type.Integer({ description: 'Number of unique tags used' }),
  thisMonthCount: Type.Integer({ description: 'Number of tracks saved this month' }),
})
