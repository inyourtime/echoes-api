import crypto from 'node:crypto'

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64)

  return `${salt}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':')

  const storedBuffer = Buffer.from(key, 'hex')
  const derivedBuffer = crypto.scryptSync(password, salt, 64)

  return crypto.timingSafeEqual(storedBuffer, derivedBuffer)
}

export function generateToken() {
  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = hashToken(rawToken)

  return { rawToken, hashedToken }
}

export function hashToken(rawToken: string) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export function generateRefreshToken() {
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const family = crypto.randomUUID()
  const hashedToken = hashToken(rawToken)

  return { refreshToken: `${family}.${rawToken}`, hashedToken }
}
