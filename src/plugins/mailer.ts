import { Resend } from 'resend'
import type { IConfig } from '../config/index.ts'
import { definePlugin } from '../utils/factories.ts'

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
    await this.#resend.emails.send({
      from: 'Echoes <no-reply@inyt.dev>',
      to: email,
      subject: 'ยืนยันอีเมลเพื่อเปิดใช้งานบัญชีของคุณ',
      html: `
        <div style="margin:0;padding:24px 12px;background-color:#eef2ff;font-family:Arial,sans-serif;color:#111827;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #dbe4ff;border-radius:20px;">
            <tr>
              <td style="padding:28px 28px 20px;background-color:#f8faff;border-bottom:1px solid #dbe4ff;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;">
                  Echoes
                </p>
                <h1 style="margin:0;font-size:28px;line-height:1.3;font-weight:700;color:#111827;">
                  ยืนยันอีเมลของคุณ
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#111827;">
                  ขอบคุณที่สมัครใช้งานกับ Echoes กรุณายืนยันอีเมลเพื่อเปิดใช้งานบัญชีและเริ่มต้นใช้งานได้ทันที
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
                  <tr>
                    <td align="center" style="border-radius:999px;background-color:#2563eb;">
                      <a
                        href="${verificationLink}"
                        style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;"
                      >
                        ยืนยันอีเมล
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">
                  หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์ได้:
                </p>
                <p style="margin:0 0 24px;padding:14px 16px;background-color:#f8faff;border:1px solid #dbe4ff;border-radius:12px;word-break:break-all;">
                  <a href="${verificationLink}" style="color:#1d4ed8;text-decoration:none;">${verificationLink}</a>
                </p>

                <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
                  หากคุณไม่ได้เป็นผู้สมัครบัญชีนี้ สามารถละเว้นอีเมลฉบับนี้ได้อย่างปลอดภัย
                </p>
              </td>
            </tr>
          </table>
        </div>
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
