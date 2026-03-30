import { Resend } from 'resend'
import { definePlugin } from '#utils/factories'
import type { IConfig } from '../config/index.ts'

declare module 'fastify' {
  interface FastifyInstance {
    mailerService: MailerService
  }
}

export class MailerService {
  #resend: Resend

  constructor(config: IConfig) {
    this.#resend = new Resend(config.mailer.resendApiKey)
  }

  async sendVerification(email: string, verificationLink: string) {
    return await this.#resend.emails.send({
      from: 'Inyt <no-reply@inyt.dev>',
      to: email,
      subject: 'Complete Sign Up',
      html: `
            <p>Click below to complete your sign up:</p>
            <a href="${verificationLink}">Complete Sign Up</a>
          `,
    })
  }
}

const plugin = definePlugin(
  {
    name: 'mailer',
  },
  async (app, { config }) => {
    app.decorate('mailerService', new MailerService(config))
  },
)

export default plugin
