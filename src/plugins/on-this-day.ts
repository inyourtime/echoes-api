import type { FastifyInstance } from 'fastify'
import { definePlugin } from '../utils/factories.ts'
import type { OnThisDayMemory } from './repositories/user-track.repository.ts'

export type OnThisDayStatus = 'processed' | 'no_memories' | 'no_push_tokens'

export type SendOnThisDayInput = {
  date?: Date
  urlTemplate?: string
  userId: string
}

export type SendOnThisDayResult = {
  date: string
  failureCount: number
  invalidatedCount: number
  memoryCount: number
  message: string
  selectedMemory: OnThisDayMemory | null
  sent: boolean
  status: OnThisDayStatus
  successCount: number
}

export type ProcessOnThisDayBroadcastInput = {
  date?: Date
  urlTemplate?: string
}

export type ProcessOnThisDayBroadcastResult = {
  date: string
  processedUsers: number
  sentUsers: number
  skippedUsers: number
}

declare module 'fastify' {
  interface FastifyInstance {
    onThisDayService: OnThisDayService
  }
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toMonthDay(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${month}-${day}`
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
  const extraLabel = extraCount > 0 ? ` ยังมีอีก ${extraCount} ความทรงจำจากวันนี้ รอให้คุณกลับไปฟังอีกครั้ง` : ''

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

export class OnThisDayService {
  #app: FastifyInstance

  constructor(app: FastifyInstance) {
    this.#app = app
  }

  isConfigured() {
    return this.#app.firebaseMessagingService.isConfigured()
  }

  async sendToUser({
    date = new Date(),
    urlTemplate = '/timeline/:id',
    userId,
  }: SendOnThisDayInput): Promise<SendOnThisDayResult> {
    const memories = await this.#app.userTrackRepository.findOnThisDayMemories({
      targetDate: date,
      userId,
    })
    const selectedMemory = memories[0] ?? null
    const isoDate = toIsoDate(date)

    if (!selectedMemory) {
      return {
        date: isoDate,
        failureCount: 0,
        invalidatedCount: 0,
        memoryCount: 0,
        message: 'No On This Day memories found.',
        selectedMemory: null,
        sent: false,
        status: 'no_memories',
        successCount: 0,
      }
    }

    if (!this.#app.firebaseMessagingService.isConfigured()) {
      throw this.#app.httpErrors.serviceUnavailable('Firebase messaging is not configured')
    }

    const tokens = await this.#app.pushTokenRepository.findByUserId(userId)

    if (tokens.length === 0) {
      return {
        date: isoDate,
        failureCount: 0,
        invalidatedCount: 0,
        memoryCount: memories.length,
        message: 'No registered push tokens for On This Day notification.',
        selectedMemory,
        sent: false,
        status: 'no_push_tokens',
        successCount: 0,
      }
    }

    const notification = buildOnThisDayNotification({
      artist: selectedMemory.track.artist,
      memoryCount: memories.length,
      title: selectedMemory.track.title,
      yearsAgo: selectedMemory.yearsAgo,
    })
    const destinationUrl = buildOnThisDayUrl(urlTemplate, selectedMemory.userTrackId)

    const result = await this.#app.firebaseMessagingService.sendToTokens({
      body: notification.body,
      data: {
        monthDay: toMonthDay(date),
        type: 'on_this_day',
        url: destinationUrl,
        userTrackId: selectedMemory.userTrackId,
      },
      title: notification.title,
      tokens: tokens.map((token) => token.token),
      url: destinationUrl,
    })

    if (result.invalidTokens.length > 0) {
      await this.#app.pushTokenRepository.deleteByTokens(result.invalidTokens)
    }

    return {
      date: isoDate,
      failureCount: result.failureCount,
      invalidatedCount: result.invalidTokens.length,
      memoryCount: memories.length,
      message: 'On This Day notification processed.',
      selectedMemory,
      sent: result.successCount > 0,
      status: 'processed',
      successCount: result.successCount,
    }
  }

  async sendToAllUsers({
    date = new Date(),
    urlTemplate = '/timeline/:id',
  }: ProcessOnThisDayBroadcastInput = {}): Promise<ProcessOnThisDayBroadcastResult> {
    if (!this.isConfigured()) {
      return {
        date: toIsoDate(date),
        processedUsers: 0,
        sentUsers: 0,
        skippedUsers: 0,
      }
    }

    const userIds = await this.#app.pushTokenRepository.findDistinctUserIds()

    let sentUsers = 0
    let skippedUsers = 0

    for (const userId of userIds) {
      const result = await this.sendToUser({
        date,
        urlTemplate,
        userId,
      })

      if (result.sent) {
        sentUsers += 1
      } else {
        skippedUsers += 1
      }
    }

    return {
      date: toIsoDate(date),
      processedUsers: userIds.length,
      sentUsers,
      skippedUsers,
    }
  }
}

const plugin = definePlugin(
  {
    name: 'on-this-day-service',
    dependencies: ['firebase-messaging', 'push-token-repository', 'user-track-repository'],
  },
  async (app) => {
    app.decorate('onThisDayService', new OnThisDayService(app))
  },
)

export default plugin
