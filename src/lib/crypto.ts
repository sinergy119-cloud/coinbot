// API Key (access_key, secret_key) AES-256-GCM 암호화/복호화
// 서버(API Routes)에서만 사용 — 브라우저에서 직접 호출 금지

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX = process.env.ENCRYPTION_KEY ?? ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error('ENCRYPTION_KEY 환경변수가 없거나 너무 짧습니다. (64자 hex 필요)')
  }
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex')
}

// 암호화: 평문 → "iv:authTag:encrypted" 형식의 문자열 반환
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

// 복호화: "iv:authTag:encrypted" → 평문
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('잘못된 암호화 데이터 형식입니다.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
