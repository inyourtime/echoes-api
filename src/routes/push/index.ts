import type { TypedRoutePlugin } from '../../utils/factories.ts'
import {
  DeletePushTokenBody,
  DeletePushTokenResponse,
  RegisterPushTokenBody,
  RegisterPushTokenResponse,
  SendOnThisDayBody,
  SendOnThisDayResponse,
  SendPushTestBody,
  SendPushTestResponse,
} from './schema.ts'

const TAGS = ['Push']

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function buildTargetDate(dateInput?: string) {
  if (dateInput) {
    const date = new Date(`${dateInput}T00:00:00.000Z`)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const isoDate = `${year}-${month}-${day}`

    if (Number.isNaN(date.getTime()) || isoDate !== dateInput) {
      return null
    }

    return {
      isoDate,
      monthDay: `${month}-${day}`,
      targetDate: date,
    }
  }

  const date = new Date()
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return {
    isoDate: `${year}-${month}-${day}`,
    monthDay: `${month}-${day}`,
    targetDate: date,
  }
}

function buildOnThisDayNotification(params: {
  artist: string
  memoryCount: number
  title: string
  yearsAgo: number
}) {
  const { artist, memoryCount, title, yearsAgo } = params
  const extraCount = memoryCount - 1
  const yearLabel = yearsAgo === 1 ? 'วันนี้เมื่อ 1 ปีก่อน' : `วันนี้เมื่อ ${yearsAgo} ปีก่อน`
  const extraLabel =
    extraCount > 0
      ? ` ยังมีอีก ${extraCount} ความทรงจำจากวันนี้ รอให้คุณกลับไปฟังอีกครั้ง`
      : ''

  return {
    body: truncateText(
      `${yearLabel} เพลง ${title} - ${artist} เคยเข้ามาอยู่ในความทรงจำของคุณ${extraLabel}`,
      240,
    ),
    title: 'วันนี้ในวันนั้น',
  }
}

function buildOnThisDayUrl(urlTemplate: string, userTrackId: string) {
  return urlTemplate.replace(':id', userTrackId)
}

const route: TypedRoutePlugin = async (app) => {
  const { firebaseMessagingService, pushTokenRepository, userTrackRepository } = app

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

  app.post(
    '/push/on-this-day',
    {
      config: { auth: true },
      schema: {
        tags: TAGS,
        summary: 'Send an On This Day push notification',
        description:
          'Find matching memories from the same calendar day in previous years and send a push notification to the authenticated user.',
        body: SendOnThisDayBody,
        response: {
          200: SendOnThisDayResponse,
          400: { $ref: 'responses#/properties/badRequest', description: 'Invalid request' },
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
      const target = buildTargetDate(request.body.date)

      if (!target) {
        throw app.httpErrors.badRequest('Invalid target date')
      }

      const { isoDate, monthDay, targetDate } = target
      const memories = await userTrackRepository.findOnThisDayMemories({
        targetDate,
        userId,
      })

      const selectedMemory = memories[0] ?? null

      if (!selectedMemory) {
        return reply.send({
          date: isoDate,
          failureCount: 0,
          invalidatedCount: 0,
          memoryCount: 0,
          message: 'No On This Day memories found.',
          selectedMemory: null,
          sent: false,
          status: 'no_memories',
          successCount: 0,
        })
      }

      if (!firebaseMessagingService.isConfigured()) {
        throw app.httpErrors.serviceUnavailable('Firebase messaging is not configured')
      }

      const tokens = await pushTokenRepository.findByUserId(userId)

      if (tokens.length === 0) {
        return reply.send({
          date: isoDate,
          failureCount: 0,
          invalidatedCount: 0,
          memoryCount: memories.length,
          message: 'No registered push tokens for On This Day notification.',
          selectedMemory,
          sent: false,
          status: 'no_push_tokens',
          successCount: 0,
        })
      }

      const notification = buildOnThisDayNotification({
        artist: selectedMemory.track.artist,
        memoryCount: memories.length,
        title: selectedMemory.track.title,
        yearsAgo: selectedMemory.yearsAgo,
      })
      const destinationUrl = buildOnThisDayUrl(request.body.url, selectedMemory.userTrackId)

      const result = await firebaseMessagingService.sendToTokens({
        body: notification.body,
        data: {
          monthDay,
          type: 'on_this_day',
          url: destinationUrl,
          userTrackId: selectedMemory.userTrackId,
        },
        title: notification.title,
        tokens: tokens.map((token) => token.token),
        url: destinationUrl,
      })

      if (result.invalidTokens.length > 0) {
        await pushTokenRepository.deleteByTokens(result.invalidTokens)
      }

      return reply.send({
        date: isoDate,
        failureCount: result.failureCount,
        invalidatedCount: result.invalidTokens.length,
        memoryCount: memories.length,
        message: 'On This Day notification processed.',
        selectedMemory,
        sent: result.successCount > 0,
        status: 'processed',
        successCount: result.successCount,
      })
    },
  )
}

export default route
