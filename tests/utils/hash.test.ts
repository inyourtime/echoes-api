import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateRefreshToken,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../src/utils/hash.ts'

test('hashPassword should return salt and hash', () => {
  const result = hashPassword('mypassword')

  const parts = result.split(':')

  assert.strictEqual(parts.length, 2)
  assert.ok(parts[0].length > 0)
  assert.ok(parts[1].length > 0)
})

test('verifyPassword should return true for correct password', () => {
  const password = 'mypassword'
  const stored = hashPassword(password)

  const result = verifyPassword(password, stored)

  assert.strictEqual(result, true)
})

test('verifyPassword should return false for incorrect password', () => {
  const stored = hashPassword('mypassword')

  const result = verifyPassword('wrongpassword', stored)

  assert.strictEqual(result, false)
})

test('hashPassword should generate different hashes for same password', () => {
  const password = 'mypassword'

  const hash1 = hashPassword(password)
  const hash2 = hashPassword(password)

  assert.notStrictEqual(hash1, hash2)
})

test('hashToken should return a SHA256 hash in hex', () => {
  const rawToken = 'someRandomToken123'
  const hashed = hashToken(rawToken)

  assert.strictEqual(typeof hashed, 'string')
  assert.strictEqual(hashed.length, 64)
  assert.ok(/^[a-f0-9]+$/.test(hashed))
})

test('hashToken should be deterministic', () => {
  const rawToken = 'testToken'
  const hash1 = hashToken(rawToken)
  const hash2 = hashToken(rawToken)

  assert.strictEqual(hash1, hash2)
})

test('hashToken should produce different hashes for different inputs', () => {
  const hash1 = hashToken('token1')
  const hash2 = hashToken('token2')

  assert.notStrictEqual(hash1, hash2)
})

test('generateToken should return an object with rawToken and hashedToken', () => {
  const result = generateToken()

  assert.strictEqual(typeof result, 'object')
  assert.ok('rawToken' in result)
  assert.ok('hashedToken' in result)
})

test('generateToken rawToken should be 64 character hex string', () => {
  const { rawToken } = generateToken()

  assert.strictEqual(typeof rawToken, 'string')
  assert.strictEqual(rawToken.length, 64)
  assert.ok(/^[a-f0-9]+$/.test(rawToken))
})

test('generateToken hashedToken should be hash of rawToken', () => {
  const { rawToken, hashedToken } = generateToken()

  const expectedHash = hashToken(rawToken)

  assert.strictEqual(hashedToken, expectedHash)
})

test('generateToken should generate unique tokens', () => {
  const token1 = generateToken()
  const token2 = generateToken()

  assert.notStrictEqual(token1.rawToken, token2.rawToken)
  assert.notStrictEqual(token1.hashedToken, token2.hashedToken)
})

test('generateRefreshToken should generate unique tokens', () => {
  const { refreshToken, hashedToken } = generateRefreshToken()

  assert.strictEqual(typeof refreshToken, 'string')
  assert.strictEqual(typeof hashedToken, 'string')
  assert.notStrictEqual(refreshToken, hashedToken)
})
