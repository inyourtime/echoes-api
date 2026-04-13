import Type from 'typebox'
import { OptionalWithDefault, TDate } from '../../plugins/shared-schemas.ts'

const PushPlatform = Type.Enum(['web'])

const PushTokenInfo = Type.Object({
  createdAt: TDate,
  id: Type.String({ format: 'uuid' }),
  lastRegisteredAt: TDate,
  platform: PushPlatform,
  updatedAt: TDate,
  userAgent: Type.Union([Type.String(), Type.Null()]),
  userId: Type.String({ format: 'uuid' }),
})

export const RegisterPushTokenBody = Type.Object({
  platform: Type.Optional(PushPlatform),
  token: Type.String({ maxLength: 4096, minLength: 1 }),
})

export const RegisterPushTokenResponse = Type.Object({
  message: Type.String(),
  pushToken: PushTokenInfo,
})

export const DeletePushTokenBody = Type.Object({
  token: Type.String({ maxLength: 4096, minLength: 1 }),
})

export const DeletePushTokenResponse = Type.Object({
  message: Type.String(),
})

export const SendPushTestBody = Type.Object({
  body: OptionalWithDefault(Type.String(), {
    default: 'การแจ้งเตือนทดสอบจาก Echoes ส่งมาถึงอุปกรณ์นี้แล้ว',
    maxLength: 240,
    minLength: 1,
  }),
  title: OptionalWithDefault(Type.String(), {
    default: 'Echoes',
    maxLength: 120,
    minLength: 1,
  }),
  url: OptionalWithDefault(Type.String(), {
    default: '/timeline',
    minLength: 1,
  }),
})

export const SendPushTestResponse = Type.Object({
  failureCount: Type.Number({ minimum: 0 }),
  invalidatedCount: Type.Number({ minimum: 0 }),
  message: Type.String(),
  successCount: Type.Number({ minimum: 0 }),
})
