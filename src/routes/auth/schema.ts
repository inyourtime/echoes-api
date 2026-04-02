import Type from 'typebox'

export const RegisterBody = Type.Object({
  email: Type.String({ format: 'email', maxLength: 255, examples: ['inyourtimeguy@gmail.com'] }),
  password: Type.String({ minLength: 8, maxLength: 512, examples: ['12345678'] }),
  name: Type.String({ minLength: 1, maxLength: 255, examples: ['John Doe'] }),
})

export const RegisterResponse = Type.Object(
  {
    user: Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.String(),
    }),
    message: Type.String(),
  },
  { description: 'Register response' },
)

export const LoginBody = Type.Object({
  email: Type.String({ format: 'email', maxLength: 255, examples: ['inyourtimeguy@gmail.com'] }),
  password: Type.String({ maxLength: 512, examples: ['12345678'] }),
})

export const TokenResponse = Type.Object({
  accessToken: Type.String({ examples: ['access_token'] }),
})

export const MeResponse = Type.Object(
  {
    user: Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.Union([Type.String(), Type.Null()]),
      avatarUrl: Type.Union([Type.String(), Type.Null()]),
    }),
  },
  { description: 'Get current user response' },
)

export const VerifyEmailBody = Type.Object({
  token: Type.String({ minLength: 1, examples: ['verification_token'] }),
})

export const VerifyEmailResponse = Type.Object({
  message: Type.String(),
})

export const ResendVerificationBody = Type.Object({
  email: Type.String({ format: 'email', minLength: 1, examples: ['inyourtimeguy@gmail.com'] }),
})

export const ResendVerificationResponse = Type.Object({
  message: Type.String(),
})

export const LogoutResponse = Type.Object({
  message: Type.String(),
})
