import Type from 'typebox'
import { defineRoute } from '../../utils/factories.ts'
import {
  CreateTagBody,
  CreateTagResponse,
  GetTagResponse,
  ListTagsResponse,
  UpdateTagBody,
  UpdateTagResponse,
} from './schema.ts'

const route = defineRoute(
  {
    prefix: '/tags',
    tags: ['Tag'],
  },
  async (app) => {
    const { tagRepository } = app

    // GET / - List all user tags
    app.get(
      '/',
      {
        config: { auth: true },
        schema: {
          summary: 'List user tags',
          description: 'Get all tags created by the current user',
          response: {
            200: ListTagsResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub

        const tags = await tagRepository.findByUserId({ userId })

        return reply.send({
          tags,
        })
      },
    )

    // POST / - Create tag
    app.post(
      '/',
      {
        config: { auth: true },
        schema: {
          summary: 'Create tag',
          description: 'Create a new tag for the current user',
          body: CreateTagBody,
          response: {
            201: CreateTagResponse,
            400: { $ref: 'responses#/properties/badRequest', description: 'Bad request' },
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            409: { $ref: 'responses#/properties/conflict', description: 'Tag already exists' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { name, color } = request.body

        // Check if tag name already exists for this user
        const existing = await tagRepository.findByName(userId, name)
        if (existing) {
          throw app.httpErrors.conflict('Tag with this name already exists')
        }

        const tag = await tagRepository.create({
          userId,
          name,
          color,
        })

        return reply.code(201).send({
          tag,
        })
      },
    )

    // GET /:id - Get single tag
    app.get(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Get tag by ID',
          description: 'Get a single tag by its ID',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'Tag ID' }),
          }),
          response: {
            200: GetTagResponse,
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'Tag not found' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params

        const tag = await tagRepository.findById(id)

        if (!tag || tag.userId !== userId) {
          throw app.httpErrors.notFound('Tag not found')
        }

        return reply.send({
          tag,
        })
      },
    )

    // PATCH /:id - Update tag
    app.patch(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Update tag',
          description: 'Update a tag name or color',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'Tag ID' }),
          }),
          body: UpdateTagBody,
          response: {
            200: UpdateTagResponse,
            400: { $ref: 'responses#/properties/badRequest', description: 'Bad request' },
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'Tag not found' },
            409: { $ref: 'responses#/properties/conflict', description: 'Tag name already exists' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params
        const { name, color } = request.body

        const existing = await tagRepository.findById(id)

        if (!existing || existing.userId !== userId) {
          throw app.httpErrors.notFound('Tag not found')
        }

        // Check name uniqueness if updating name
        if (name && name !== existing.name) {
          const nameExists = await tagRepository.findByName(userId, name)
          if (nameExists) {
            throw app.httpErrors.conflict('Tag with this name already exists')
          }
        }

        const updates: Partial<{ name: string; color: string | undefined }> = {}
        if (name !== undefined) updates.name = name
        if (color !== undefined) updates.color = color

        if (Object.keys(updates).length === 0) {
          throw app.httpErrors.badRequest('No fields to update')
        }

        const tag = await tagRepository.update(id, updates)

        return reply.send({
          tag,
        })
      },
    )

    // DELETE /:id - Delete tag
    app.delete(
      '/:id',
      {
        config: { auth: true },
        schema: {
          summary: 'Delete tag',
          description: 'Delete a tag and remove it from all user tracks',
          params: Type.Object({
            id: Type.String({ format: 'uuid', description: 'Tag ID' }),
          }),
          response: {
            204: Type.Null(),
            401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
            404: { $ref: 'responses#/properties/notFound', description: 'Tag not found' },
          },
        },
      },
      async (request, reply) => {
        const userId = request.getUser().sub
        const { id } = request.params

        const existing = await tagRepository.findById(id)

        if (!existing || existing.userId !== userId) {
          throw app.httpErrors.notFound('Tag not found')
        }

        await tagRepository.delete(id)

        return reply.code(204).send(null)
      },
    )
  },
)

export default route
