import Type from 'typebox'
import type { Tag, Track, UserTrack } from '../../db/schema/index.ts'
import { defineRoute } from '../../utils/factories.ts'
import {
  CreateUserTrackBody,
  CreateUserTrackResponse,
  GetUserTrackResponse,
  ListUserTracksQuery,
  ListUserTracksResponse,
  UpdateUserTrackBody,
  UpdateUserTrackResponse,
} from './schema.ts'

// UserTrack with track relation from repository
interface UserTrackWithTrack extends UserTrack {
  track: Track
}

// UserTrackTag with tag relation from repository
interface UserTrackTagWithTag {
  userTrackId: string
  tagId: string
  tag: Tag
}

// Helper to format user track with track and tags for response
function formatUserTrack(ut: UserTrackWithTrack, userTrackTags: UserTrackTagWithTag[]) {
  const track = ut.track
  return {
    ...ut,
    listenedAt: ut.listenedAt.toISOString(),
    createdAt: ut.createdAt.toISOString(),
    updatedAt: ut.updatedAt.toISOString(),
    track: {
      ...track,
      album: track.album ?? null,
      albumArtUrl: track.albumArtUrl ?? null,
      genre: track.genre ?? null,
      durationMs: track.durationMs ?? null,
      spotifyTrackId: track.spotifyTrackId ?? null,
    },
    tags: userTrackTags.map((utt) => ({
      ...utt.tag,
      color: utt.tag.color ?? null,
      createdAt: utt.tag.createdAt.toISOString(),
    })),
  }
}

const route = defineRoute(
  {
    prefix: '/user-track',
    tags: ['User Track'],
  },
  async (app) => {
    const { trackRepository, userTrackRepository, userTrackTagRepository, tagRepository } = app

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

        // Get tags for this user track
        const userTrackTags = await userTrackTagRepository.findByUserTrackId(id)

        return reply.send({
          userTrack: formatUserTrack(userTrack, userTrackTags),
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
        const { note, youtubeUrl, listenedAt, tagIds } = request.body

        // Check user track exists and belongs to user
        const userTrack = await userTrackRepository.findById(id)
        if (!userTrack) {
          throw app.httpErrors.notFound('User track not found')
        }
        if (userTrack.userId !== userId) {
          throw app.httpErrors.notFound('User track not found')
        }

        // Build update object with only provided fields
        const updates: Record<string, unknown> = {}
        if (note !== undefined) updates.note = note
        if (youtubeUrl !== undefined) updates.youtubeUrl = youtubeUrl
        if (listenedAt !== undefined) updates.listenedAt = new Date(listenedAt)

        // Update user track if there are changes
        if (Object.keys(updates).length > 0) {
          await userTrackRepository.update(id, updates)
        }

        // Update tags if provided
        if (tagIds !== undefined) {
          // Verify all tags belong to the user
          for (const tagId of tagIds) {
            const tag = await tagRepository.findById(tagId)
            if (!tag || tag.userId !== userId) {
              throw app.httpErrors.badRequest(`Invalid tag ID: ${tagId}`)
            }
          }
          // Use setTags to efficiently update (adds new, removes old)
          await userTrackTagRepository.setTags(id, tagIds)
        }

        // Fetch updated user track with tags
        const updatedUserTrack = await userTrackRepository.findById(id)
        if (!updatedUserTrack) {
          throw app.httpErrors.internalServerError('Failed to update user track')
        }

        const userTrackTags = await userTrackTagRepository.findByUserTrackId(id)

        return reply.send({
          userTrack: formatUserTrack(updatedUserTrack, userTrackTags),
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
        const query = request.query

        const limit = query.limit ?? 20
        const offset = query.offset ?? 0
        const sort = query.sort ?? 'listenedAt'
        const order = query.order ?? 'desc'

        const { items, total } = await userTrackRepository.findManyByUserId({
          userId,
          limit,
          offset,
          sort,
          order,
        })

        // Fetch tags for each user track
        const userTracksWithTags = await Promise.all(
          items.map(async (ut) => {
            const userTrackTags = await userTrackTagRepository.findByUserTrackId(ut.id)
            return formatUserTrack(ut, userTrackTags)
          }),
        )

        return reply.send({
          userTracks: userTracksWithTags,
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + items.length < total,
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
          description:
            'Create a user track entry. Either provide spotifyTrackId (to auto-fetch from Spotify) OR manualTrack (to create manually).',
          body: CreateUserTrackBody,
          response: {
            201: CreateUserTrackResponse,
            400: { $ref: 'responses#/properties/badRequest', description: 'Invalid request' },
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { spotifyTrackId, manualTrack, note, youtubeUrl, listenedAt, tagIds } = request.body

        // Validate that exactly one of spotifyTrackId or manualTrack is provided
        if (spotifyTrackId && manualTrack) {
          throw app.httpErrors.badRequest(
            'Cannot provide both spotifyTrackId and manualTrack. Choose one.',
          )
        }
        if (!spotifyTrackId && !manualTrack) {
          throw app.httpErrors.badRequest('Must provide either spotifyTrackId or manualTrack.')
        }

        let trackId: string

        if (spotifyTrackId) {
          // Try to find existing track by Spotify ID
          let track = await trackRepository.findBySpotifyId(spotifyTrackId)

          if (!track) {
            // Create new track with Spotify source
            track = await trackRepository.create({
              source: 'spotify',
              spotifyTrackId,
              title: 'Unknown Title',
              artist: 'Unknown Artist',
            })
          }

          trackId = track.id
        } else {
          // manualTrack is guaranteed to exist here due to validation above
          const mt = manualTrack!

          // Normalize for deduplication
          const titleNormalized = mt.title.toLowerCase().trim()
          const artistNormalized = mt.artist.toLowerCase().trim()

          // Try to find existing track by normalized title + artist
          let track = await trackRepository.findByNormalizedTitleArtist(
            titleNormalized,
            artistNormalized,
          )

          if (!track) {
            // Create new manual track
            track = await trackRepository.create({
              source: 'manual',
              title: mt.title,
              artist: mt.artist,
              titleNormalized,
              artistNormalized,
              album: mt.album,
              albumArtUrl: mt.albumArtUrl,
              genre: mt.genre,
              durationMs: mt.durationMs,
            })
          }

          trackId = track.id
        }

        // Create user track entry
        const userTrack = await userTrackRepository.create({
          userId,
          trackId,
          note,
          youtubeUrl,
          listenedAt: listenedAt ? new Date(listenedAt) : new Date(),
        })

        // Attach tags if provided
        if (tagIds && tagIds.length > 0) {
          // Verify all tags belong to the user
          for (const tagId of tagIds) {
            const tag = await tagRepository.findById(tagId)
            if (!tag || tag.userId !== userId) {
              throw app.httpErrors.badRequest(`Invalid tag ID: ${tagId}`)
            }
            await userTrackTagRepository.create({
              userTrackId: userTrack.id,
              tagId,
            })
          }
        }

        // Fetch the complete user track with track and tags for response
        const userTrackWithTrack = await userTrackRepository.findById(userTrack.id)
        if (!userTrackWithTrack) {
          throw app.httpErrors.internalServerError('Failed to create user track')
        }

        const userTrackTags = await userTrackTagRepository.findByUserTrackId(userTrack.id)

        return reply.code(201).send({
          userTrack: formatUserTrack(userTrackWithTrack, userTrackTags),
        })
      },
    )
  },
)

export default route
