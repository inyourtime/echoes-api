import type { FastifyInstance } from 'fastify'
import { definePlugin } from '../utils/factories.ts'

type TurnstileVerifyOptions = {
  token?: string
  remoteIp?: string
  expectedAction?: string
  expectedHostname?: string[]
}

type TurnstileSiteverifyResponse = {
  success: boolean
  'error-codes'?: string[]
  action?: string
  hostname?: string
}

declare module 'fastify' {
  interface FastifyInstance {
    turnstileService: TurnstileService
  }
}

export class TurnstileService {
  #app: FastifyInstance
  #enabled: boolean
  #secretKey: string | null
  #expectedAction: string
  #expectedHostname: string[] | null
  #timeoutMs: number

  constructor(
    app: FastifyInstance,
    config: {
      enabled: boolean
      secretKey: string | null
      expectedAction: string
      expectedHostname: string[] | null
      timeoutMs: number
    },
  ) {
    this.#app = app
    this.#enabled = config.enabled
    this.#secretKey = config.secretKey
    this.#expectedAction = config.expectedAction
    this.#expectedHostname = config.expectedHostname
    this.#timeoutMs = config.timeoutMs
  }

  async verifyOrThrow(options: TurnstileVerifyOptions = {}) {
    if (!this.#enabled) {
      return
    }

    if (!options.token) {
      throw this.#app.httpErrors.badRequest('Turnstile token is required')
    }

    if (!this.#secretKey) {
      this.#app.log.error('Turnstile is enabled but secret key is not configured')
      throw this.#app.httpErrors.serviceUnavailable('Verification service unavailable')
    }

    let response: TurnstileSiteverifyResponse

    try {
      response = await this.#verifyWithSiteverify(options)
    } catch (error) {
      this.#app.log.error(error, 'Turnstile siteverify request failed')
      throw this.#app.httpErrors.serviceUnavailable('Verification service unavailable')
    }

    if (!response.success) {
      const errorCodes = response['error-codes'] ?? []

      this.#app.log.warn(
        {
          turnstileErrorCodes: errorCodes,
        },
        'Turnstile verification failed',
      )

      throw this.#app.httpErrors.badRequest('Turnstile verification failed')
    }

    const expectedAction = options.expectedAction ?? this.#expectedAction
    if (expectedAction && response.action !== expectedAction) {
      this.#app.log.warn(
        {
          expectedAction,
          receivedAction: response.action ?? null,
        },
        'Turnstile action mismatch',
      )

      throw this.#app.httpErrors.badRequest('Turnstile verification failed')
    }

    const expectedHostname = options.expectedHostname ?? this.#expectedHostname
    if (expectedHostname && response.hostname && !expectedHostname.includes(response.hostname)) {
      this.#app.log.warn(
        {
          expectedHostname,
          receivedHostname: response.hostname ?? null,
        },
        'Turnstile hostname mismatch',
      )

      throw this.#app.httpErrors.badRequest('Turnstile verification failed')
    }
  }

  async #verifyWithSiteverify(
    options: TurnstileVerifyOptions,
  ): Promise<TurnstileSiteverifyResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.#timeoutMs)

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.#secretKey,
          response: options.token,
          remoteip: options.remoteIp,
          idempotency_key: crypto.randomUUID(),
        }),
        signal: controller.signal,
      })

      return (await response.json()) as TurnstileSiteverifyResponse
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

const plugin = definePlugin(
  {
    name: 'turnstile',
  },
  async (app, { config }) => {
    app.decorate('turnstileService', new TurnstileService(app, config.turnstile))
  },
)

export default plugin
