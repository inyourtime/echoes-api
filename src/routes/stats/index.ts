import type { TypedRoutePlugin } from '../../utils/factories.ts'
import {
  MonthlyActivityQuery,
  MonthlyActivityResponse,
  OverviewStatsResponse,
  TagDistributionResponse,
  TopArtistsQuery,
  TopArtistsResponse,
} from './schema.ts'

const TAGS = ['Stats']

const route: TypedRoutePlugin = async (app) => {
  const { statsRepository } = app

  // GET /stats/top-artists - Top artists by save count
  app.get(
    '/stats/top-artists',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Get top artists',
        description: 'Get the most saved artists for the authenticated user',
        querystring: TopArtistsQuery,
        response: {
          200: TopArtistsResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub
      const { limit } = request.query

      const artists = await statsRepository.getTopArtists(userId, limit)

      return reply.send({ artists })
    },
  )

  // GET /stats/monthly-activity - Monthly track activity
  app.get(
    '/stats/monthly-activity',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Get monthly activity',
        description: 'Get track save activity per month for the last N months',
        querystring: MonthlyActivityQuery,
        response: {
          200: MonthlyActivityResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub
      const { months } = request.query

      const activity = await statsRepository.getMonthlyActivity(userId, months)

      return reply.send({ activity })
    },
  )

  // GET /stats/tag-distribution - Tag usage distribution
  app.get(
    '/stats/tag-distribution',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Get tag distribution',
        description: 'Get the distribution of tags used across all user tracks',
        response: {
          200: TagDistributionResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub

      const distribution = await statsRepository.getTagDistribution(userId)
      const totalTagged = distribution.reduce((sum, item) => sum + item.count, 0)

      return reply.send({ distribution, totalTagged })
    },
  )

  // GET /stats/overview - Combined overview stats
  app.get(
    '/stats/overview',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Get overview stats',
        description: 'Get combined overview statistics for the user dashboard',
        response: {
          200: OverviewStatsResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub

      const stats = await statsRepository.getOverview(userId)

      return reply.send(stats)
    },
  )
}

export default route
