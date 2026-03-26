import Type from 'typebox'

export const RegisterBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  name: Type.String({ minLength: 1 }),
})

export const RegisterResponse = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.String(),
  }),
  message: Type.String(),
})

export const LoginBody = Type.Object({
  email: Type.String({ format: 'email', examples: ['inyourtimeguy@gmail.com'] }),
  password: Type.String({ examples: ['12345678'] }),
})

export const TokenResponse = Type.Object({
  accessToken: Type.String({ examples: ['access_token'] }),
})

export const MeResponse = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.Union([Type.String(), Type.Null()]),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
  }),
})

export const VerifyEmailBody = Type.Object({
  token: Type.String({ minLength: 1 }),
})

export const VerifyEmailResponse = Type.Object({
  message: Type.String(),
})

export const ResendVerificationBody = Type.Object({
  email: Type.String({ format: 'email', minLength: 1 }),
})

export const ResendVerificationResponse = Type.Object({
  message: Type.String(),
})
