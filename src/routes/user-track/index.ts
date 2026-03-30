import Type from 'typebox'
import { defineRoute } from '#utils/factories'
import { normalizeText } from '#utils/normalize'
import {
  CreateUserTrackBody,
  CreateUserTrackResponse,
  GetUserTrackResponse,
  ListUserTracksQuery,
  ListUserTracksResponse,
  SearchUserTracksQuery,
  SearchUserTracksResponse,
  UpdateUserTrackBody,
  UpdateUserTrackResponse,
} from './schema.ts'

const route = defineRoute(
  {
    prefix: '/user-track',
    tags: ['User Track'],
  },
  async (app) => {
    const { trackRepository, userTrackRepository } = app

    // GET /:id - Get single user track by ID
    app.get(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Get user track by ID',
          description: 'Get a single user track entry with track details and tags',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'User track ID' }),
          }),
          response: {
            200: GetUserTrackResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'User track not found' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params

        const userTrack = await userTrackRepository.findById(id)

        if (!userTrack) {
          throw app.httpErrors.notFound('User track not found')
        }

        // Verify ownership
        if (userTrack.userId !== userId) {
          throw app.httpErrors.notFound('User track not found')
        }

        return reply.send({
          userTrack,
        })
      },
    )

    // PATCH /:id - Update user track
    app.patch(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Update user track',
          description: 'Update user track fields and/or tags',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'User track ID' }),
          }),
          body: UpdateUserTrackBody,
          response: {
            200: UpdateUserTrackResponse,
            400: { $ref: 'responses#/properties/badRequest', description: 'Invalid request' },
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'User track not found' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params
        const { note, youtubeUrl, listenedAt, tagIds, track } = request.body

        // Check user track exists and belongs to user
        const userTrack = await userTrackRepository.findById(id)
        if (!userTrack) {
          throw app.httpErrors.notFound('User track not found')
        }
        if (userTrack.userId !== userId) {
          throw app.httpErrors.notFound('User track not found')
        }

        await userTrackRepository.updateTrackAndTags(
          userTrack,
          { note, youtubeUrl, listenedAt: listenedAt ? new Date(listenedAt) : undefined },
          track,
          tagIds,
        )

        // Fetch updated user track with tags
        const updatedUserTrack = await userTrackRepository.findById(id)
        if (!updatedUserTrack) {
          throw app.httpErrors.internalServerError('Failed to update user track')
        }

        return reply.send({
          userTrack: updatedUserTrack,
        })
      },
    )

    // DELETE /:id - Delete user track
    app.delete(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Delete user track',
          description: 'Delete a user track entry',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'User track ID' }),
          }),
          response: {
            204: Type.Null({ description: 'Successfully deleted' }),
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'User track not found' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params

        // Check user track exists and belongs to user
        const userTrack = await userTrackRepository.findById(id)
        if (!userTrack) {
          throw app.httpErrors.notFound('User track not found')
        }
        if (userTrack.userId !== userId) {
          throw app.httpErrors.notFound('User track not found')
        }

        // Delete user track (cascade will handle user_track_tags)
        await userTrackRepository.delete(id)

        return reply.code(204).send(null)
      },
    )

    // GET / - List user tracks with pagination
    app.get(
      '/',
      {
        config: { auth: true },
        schema: {
          summary: 'List user tracks',
          description: 'Get paginated list of user tracks with optional sorting and tags',
          querystring: ListUserTracksQuery,
          response: {
            200: ListUserTracksResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { query } = request

        const { items, nextCursor } = await userTrackRepository.findManyByUserId({
          userId,
          ...query,
        })

        return reply.send({
          userTracks: items,
          meta: {
            limit: query.limit,
            nextCursor,
          },
        })
      },
    )

    // POST /search - Search user tracks
    app.post(
      '/search',
      {
        config: { auth: true },
        schema: {
          summary: 'Search user tracks',
          description: 'Search user tracks by track title and artist with full-text search',
          body: SearchUserTracksQuery,
          response: {
            200: SearchUserTracksResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { body } = request

        const { items, nextCursor } = await userTrackRepository.searchByUserId({
          userId,
          ...body,
        })

        return reply.send({
          userTracks: items,
          meta: {
            limit: body.limit,
            nextCursor,
          },
        })
      },
    )

    app.post(
      '/',
      {
        config: { auth: true },
        schema: {
          summary: 'Create a user track entry',
          description: 'Create a user track entry',
          body: CreateUserTrackBody,
          response: {
            201: CreateUserTrackResponse,
            400: { $ref: 'responses#/properties/badRequest', description: 'Invalid request' },
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            409: { $ref: 'responses#/properties/conflict', description: 'Already logged track' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { externalId, track, note, youtubeUrl, listenedAt, tagIds } = request.body

        const listenedAtDate = listenedAt ? new Date(listenedAt) : new Date()

        const titleNormalized = normalizeText(track.title)
        const artistNormalized = normalizeText(track.artist)

        let existTrack = await trackRepository.findByNormalizedTitleArtist(
          titleNormalized,
          artistNormalized,
        )

        if (!existTrack) {
          existTrack = await trackRepository.create({
            source: externalId ? 'apple-music' : 'manual',
            externalId: externalId ? externalId : null,
            title: track.title,
            artist: track.artist,
            titleNormalized,
            artistNormalized,
          })
        }

        const trackId = existTrack.id

        // Check for duplicate user track on same day
        const existingUserTrack = await userTrackRepository.findByUserIdAndTrackIdOnSameDay(
          userId,
          trackId,
          listenedAtDate,
        )
        if (existingUserTrack) {
          throw app.httpErrors.conflict(
            `You have already logged this track on ${listenedAtDate.toISOString().split('T')[0]}`,
          )
        }

        // Create user track entry
        const userTrack = await userTrackRepository.createWithTags(
          {
            userId,
            trackId,
            note,
            youtubeUrl,
            listenedAt: listenedAtDate,
          },
          tagIds,
        )

        // Fetch the complete user track with track and tags for response
        const userTrackWithTrack = await userTrackRepository.findById(userTrack.id)
        if (!userTrackWithTrack) {
          throw app.httpErrors.internalServerError('Failed to create user track')
        }

        return reply.code(201).send({
          userTrack: userTrackWithTrack,
        })
      },
    )
  },
)

export default route
