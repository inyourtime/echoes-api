import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, injectWithAccessToken } from '../../helper.ts'

const user = {
  email: 'tags-user@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  tokenVersion: 1,
}

const otherUserId = '22222222-2222-4222-8222-222222222222'

const createdAt = new Date('2026-04-12T12:00:00.000Z')

function createTagFixture(overrides: Record<string, unknown> = {}) {
  return {
    color: '#ff5500',
    createdAt,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Favorites',
    userId: user.id,
    ...overrides,
  }
}

describe('tags routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('GET /tags should return unauthorized when access token is missing', async () => {
    const findByUserIdMock = mock.fn(async (_input) => [])
    app.tagRepository.findByUserId = findByUserIdMock

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tags',
    })

    assert.strictEqual(response.statusCode, 401)
    assert.strictEqual(response.json().error, 'Unauthorized')
    assert.strictEqual(findByUserIdMock.mock.callCount(), 0)
  })

  test('GET /tags should list tags for authenticated user', async () => {
    const tags = [
      createTagFixture({ color: null, id: '33333333-3333-4333-8333-333333333333' }),
      createTagFixture({
        color: '#0088ff',
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Road trip',
      }),
    ]
    const findByUserIdMock = mock.fn(async (_input) => tags)
    app.tagRepository.findByUserId = findByUserIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: '/api/v1/tags',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      tags: tags.map((tag) => ({
        ...tag,
        createdAt: tag.createdAt.toISOString(),
      })),
    })
    assert.strictEqual(findByUserIdMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByUserIdMock.mock.calls[0].arguments[0], {
      userId: user.id,
    })
  })

  test('POST /tags should create a tag for authenticated user', async () => {
    const tag = createTagFixture()
    const findByNameMock = mock.fn(async (_userId: string, _name: string) => undefined)
    const createMock = mock.fn(async (_input) => tag)
    app.tagRepository.findByName = findByNameMock
    app.tagRepository.create = createMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          color: tag.color,
          name: tag.name,
        },
        url: '/api/v1/tags',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 201)
    assert.deepStrictEqual(response.json(), {
      tag: {
        ...tag,
        createdAt: tag.createdAt.toISOString(),
      },
    })
    assert.strictEqual(findByNameMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByNameMock.mock.calls[0].arguments, [user.id, tag.name])
    assert.strictEqual(createMock.mock.callCount(), 1)
    assert.deepStrictEqual(createMock.mock.calls[0].arguments[0], {
      color: tag.color,
      name: tag.name,
      userId: user.id,
    })
  })

  test('POST /tags should return conflict when tag name already exists', async () => {
    const tag = createTagFixture()
    const findByNameMock = mock.fn(async (_userId: string, _name: string) => tag)
    const createMock = mock.fn(async (_input) => tag)
    app.tagRepository.findByName = findByNameMock
    app.tagRepository.create = createMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'POST',
        payload: {
          name: tag.name,
        },
        url: '/api/v1/tags',
      },
      user,
    )

    assert.strictEqual(response.statusCode, 409)
    assert.deepStrictEqual(response.json(), {
      error: 'Conflict',
      message: 'Tag with this name already exists',
      statusCode: 409,
    })
    assert.strictEqual(findByNameMock.mock.callCount(), 1)
    assert.strictEqual(createMock.mock.callCount(), 0)
  })

  test('GET /tags/:id should return a tag owned by authenticated user', async () => {
    const tag = createTagFixture()
    const findByIdMock = mock.fn(async (_id: string) => tag)
    app.tagRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/tags/${tag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      tag: {
        ...tag,
        createdAt: tag.createdAt.toISOString(),
      },
    })
    assert.strictEqual(findByIdMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByIdMock.mock.calls[0].arguments, [tag.id])
  })

  test('GET /tags/:id should return not found when tag belongs to another user', async () => {
    const tag = createTagFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => tag)
    app.tagRepository.findById = findByIdMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'GET',
        url: `/api/v1/tags/${tag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'Tag not found',
      statusCode: 404,
    })
  })

  test('PATCH /tags/:id should update tag fields', async () => {
    const existingTag = createTagFixture()
    const updatedTag = createTagFixture({ color: '#00aa55', name: 'Running' })
    const findByIdMock = mock.fn(async (_id: string) => existingTag)
    const findByNameMock = mock.fn(async (_userId: string, _name: string) => undefined)
    const updateMock = mock.fn(async (_id: string, _updates) => updatedTag)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.findByName = findByNameMock
    app.tagRepository.update = updateMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          color: updatedTag.color,
          name: updatedTag.name,
        },
        url: `/api/v1/tags/${existingTag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.deepStrictEqual(response.json(), {
      tag: {
        ...updatedTag,
        createdAt: updatedTag.createdAt.toISOString(),
      },
    })
    assert.strictEqual(findByNameMock.mock.callCount(), 1)
    assert.deepStrictEqual(findByNameMock.mock.calls[0].arguments, [user.id, updatedTag.name])
    assert.strictEqual(updateMock.mock.callCount(), 1)
    assert.deepStrictEqual(updateMock.mock.calls[0].arguments, [
      existingTag.id,
      {
        color: updatedTag.color,
        name: updatedTag.name,
      },
    ])
  })

  test('PATCH /tags/:id should skip name uniqueness check when name is unchanged', async () => {
    const existingTag = createTagFixture()
    const updatedTag = createTagFixture({ color: '#00aa55' })
    const findByIdMock = mock.fn(async (_id: string) => existingTag)
    const findByNameMock = mock.fn(async (_userId: string, _name: string) => undefined)
    const updateMock = mock.fn(async (_id: string, _updates) => updatedTag)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.findByName = findByNameMock
    app.tagRepository.update = updateMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          color: updatedTag.color,
          name: existingTag.name,
        },
        url: `/api/v1/tags/${existingTag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(findByNameMock.mock.callCount(), 0)
    assert.deepStrictEqual(updateMock.mock.calls[0].arguments[1], {
      color: updatedTag.color,
      name: existingTag.name,
    })
  })

  test('PATCH /tags/:id should return bad request when no fields are provided', async () => {
    const existingTag = createTagFixture()
    const findByIdMock = mock.fn(async (_id: string) => existingTag)
    const updateMock = mock.fn(async (_id: string, _updates) => existingTag)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.update = updateMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {},
        url: `/api/v1/tags/${existingTag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 400)
    assert.deepStrictEqual(response.json(), {
      error: 'Bad Request',
      message: 'No fields to update',
      statusCode: 400,
    })
    assert.strictEqual(updateMock.mock.callCount(), 0)
  })

  test('PATCH /tags/:id should return conflict when new name already exists', async () => {
    const existingTag = createTagFixture()
    const duplicateTag = createTagFixture({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Running',
    })
    const findByIdMock = mock.fn(async (_id: string) => existingTag)
    const findByNameMock = mock.fn(async (_userId: string, _name: string) => duplicateTag)
    const updateMock = mock.fn(async (_id: string, _updates) => duplicateTag)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.findByName = findByNameMock
    app.tagRepository.update = updateMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          name: duplicateTag.name,
        },
        url: `/api/v1/tags/${existingTag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 409)
    assert.deepStrictEqual(response.json(), {
      error: 'Conflict',
      message: 'Tag with this name already exists',
      statusCode: 409,
    })
    assert.strictEqual(updateMock.mock.callCount(), 0)
  })

  test('PATCH /tags/:id should return not found when tag does not belong to user', async () => {
    const tag = createTagFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => tag)
    const updateMock = mock.fn(async (_id: string, _updates) => tag)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.update = updateMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'PATCH',
        payload: {
          name: 'Running',
        },
        url: `/api/v1/tags/${tag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'Tag not found',
      statusCode: 404,
    })
    assert.strictEqual(updateMock.mock.callCount(), 0)
  })

  test('DELETE /tags/:id should delete a tag owned by authenticated user', async () => {
    const tag = createTagFixture()
    const findByIdMock = mock.fn(async (_id: string) => tag)
    const deleteMock = mock.fn(async (_id: string) => undefined)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.delete = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/tags/${tag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 204)
    assert.strictEqual(response.body, '')
    assert.strictEqual(deleteMock.mock.callCount(), 1)
    assert.deepStrictEqual(deleteMock.mock.calls[0].arguments, [tag.id])
  })

  test('DELETE /tags/:id should return not found when tag does not belong to user', async () => {
    const tag = createTagFixture({ userId: otherUserId })
    const findByIdMock = mock.fn(async (_id: string) => tag)
    const deleteMock = mock.fn(async (_id: string) => undefined)
    app.tagRepository.findById = findByIdMock
    app.tagRepository.delete = deleteMock

    const response = await injectWithAccessToken(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/tags/${tag.id}`,
      },
      user,
    )

    assert.strictEqual(response.statusCode, 404)
    assert.deepStrictEqual(response.json(), {
      error: 'Not Found',
      message: 'Tag not found',
      statusCode: 404,
    })
    assert.strictEqual(deleteMock.mock.callCount(), 0)
  })
})
