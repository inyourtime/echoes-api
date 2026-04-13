import type { TypedRoutePlugin } from '../../utils/factories.ts'
import {
  DeletePushTokenBody,
  DeletePushTokenResponse,
  RegisterPushTokenBody,
  RegisterPushTokenResponse,
  SendPushTestBody,
  SendPushTestResponse,
} from './schema.ts'

const TAGS = ['Push']

const route: TypedRoutePlugin = async (app) => {
  const { firebaseMessagingService, pushTokenRepository } = app

  app.post(
    '/push/tokens',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Register a push token',
        description:
          'Register or refresh a Firebase Cloud Messaging token for the authenticated user.',
        body: RegisterPushTokenBody,
        response: {
          201: RegisterPushTokenResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub
      const pushToken = await pushTokenRepository.createOrUpdate({
        platform: request.body.platform ?? 'web',
        token: request.body.token.trim(),
        userAgent: request.headers['user-agent'] || null,
        userId,
      })

      return reply.code(201).send({
        message: 'Push token registered successfully.',
        pushToken,
      })
    },
  )

  app.delete(
    '/push/tokens',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Delete a push token',
        description: 'Remove a Firebase Cloud Messaging token for the authenticated user.',
        body: DeletePushTokenBody,
        response: {
          200: DeletePushTokenResponse,
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub

      await pushTokenRepository.deleteByUserIdAndToken(userId, request.body.token.trim())

      return reply.send({
        message: 'Push token removed successfully.',
      })
    },
  )

  app.post(
    '/push/test',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Send a test push notification',
        description:
          'Send a test push notification to all registered devices of the authenticated user.',
        body: SendPushTestBody,
        response: {
          200: SendPushTestResponse,
          400: {
            $ref: 'responses#/properties/badRequest',
            description: 'No push token registered',
          },
          401: { $ref: 'responses#/properties/unauthorized', description: 'Unauthorized' },
          503: {
            $ref: 'responses#/properties/serviceUnavailable',
            description: 'Firebase messaging is not configured',
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.getUser().sub

      if (!firebaseMessagingService.isConfigured()) {
        throw app.httpErrors.serviceUnavailable('Firebase messaging is not configured')
      }

      const tokens = await pushTokenRepository.findByUserId(userId)

      if (tokens.length === 0) {
        throw app.httpErrors.badRequest('No push tokens registered for this user')
      }

      const { body, title, url } = request.body

      const result = await firebaseMessagingService.sendToTokens({
        body,
        data: {
          url,
        },
        title,
        tokens: tokens.map((token) => token.token),
        url,
      })

      if (result.invalidTokens.length > 0) {
        await pushTokenRepository.deleteByTokens(result.invalidTokens)
      }

      return reply.send({
        failureCount: result.failureCount,
        invalidatedCount: result.invalidTokens.length,
        message: 'Test push notification processed.',
        successCount: result.successCount,
      })
    },
  )
}

export default route
