import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging, type Messaging, type SendResponse } from 'firebase-admin/messaging'
import type { IConfig } from '../config/index.ts'
import { definePlugin } from '../utils/factories.ts'

const FIREBASE_APP_NAME = 'echoes'
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
])

export type SendPushNotificationInput = {
  body: string
  data?: Record<string, string>
  title: string
  tokens: string[]
  url?: string
}

export type SendPushNotificationResult = {
  failureCount: number
  invalidTokens: string[]
  responses: Array<{
    errorCode?: string
    messageId?: string
    success: boolean
    token: string
  }>
  successCount: number
}

declare module 'fastify' {
  interface FastifyInstance {
    firebaseMessagingService: FirebaseMessagingService
  }
}

function isInvalidTokenResponse(response: SendResponse) {
  return Boolean(response.error?.code && INVALID_TOKEN_ERROR_CODES.has(response.error.code))
}

export class FirebaseMessagingService {
  #messaging: Messaging | null = null

  constructor(config: IConfig) {
    const { clientEmail, privateKey, projectId } = config.firebase

    if (!projectId || !clientEmail || !privateKey) {
      return
    }

    const firebaseApp =
      getApps().find((app) => app.name === FIREBASE_APP_NAME) ||
      initializeApp(
        {
          credential: cert({
            clientEmail,
            privateKey,
            projectId,
          }),
          projectId,
        },
        FIREBASE_APP_NAME,
      )

    this.#messaging = getMessaging(getApp(firebaseApp.name))
  }

  isConfigured() {
    return this.#messaging !== null
  }

  async sendToTokens({
    body,
    data,
    title,
    tokens,
    url,
  }: SendPushNotificationInput): Promise<SendPushNotificationResult> {
    if (!this.#messaging) {
      throw new Error('Firebase messaging is not configured')
    }

    const sanitizedTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)))

    if (sanitizedTokens.length === 0) {
      return {
        failureCount: 0,
        invalidTokens: [],
        responses: [],
        successCount: 0,
      }
    }

    const batchResponse = await this.#messaging.sendEach(
      sanitizedTokens.map((token) => ({
        data,
        notification: {
          body,
          title,
        },
        token,
        webpush: {
          fcmOptions: url ? { link: url } : undefined,
          notification: {
            icon: '/pwa-192.png',
          },
        },
      })),
    )

    const responses = batchResponse.responses.map((response, index) => ({
      errorCode: response.error?.code,
      messageId: response.messageId,
      success: response.success,
      token: sanitizedTokens[index]!,
    }))

    return {
      failureCount: batchResponse.failureCount,
      invalidTokens: responses
        .filter((_response, index) => isInvalidTokenResponse(batchResponse.responses[index]!))
        .map((response) => response.token),
      responses,
      successCount: batchResponse.successCount,
    }
  }
}

const plugin = definePlugin(
  {
    name: 'firebase-messaging',
  },
  async (app, { config }) => {
    app.decorate('firebaseMessagingService', new FirebaseMessagingService(config))
  },
)

export default plugin
