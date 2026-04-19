// 앱 클라이언트 측 암호화 (브라우저 WebCrypto)
// design-security.md §1-2 (PBKDF2-SHA256 600K + AES-GCM 256)

'use client'

const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

function assertBrowser() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('이 기능은 브라우저에서만 사용할 수 있습니다.')
  }
}

// 랜덤 바이트 생성
export function randomBytes(n: number): Uint8Array {
  assertBrowser()
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return arr
}

// 새 솔트 생성
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES)
}

// PIN → 마스터 키 유도 (PBKDF2)
async function deriveMasterKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  assertBrowser()
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// PIN 검증용 해시 (추후 PIN 재입력 시 틀린지 확인)
export async function hashPin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  assertBrowser()
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

// 타이밍 안전 비교
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// 암호화: plaintext → { iv, ciphertext }
export async function encryptData(pin: string, salt: Uint8Array, plaintext: string): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  assertBrowser()
  const masterKey = await deriveMasterKey(pin, salt)
  const iv = randomBytes(IV_BYTES)
  const enc = new TextEncoder().encode(plaintext)
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, masterKey, enc)
  return { iv, ciphertext: new Uint8Array(buf) }
}

// 복호화 — 실패 시 throw (PIN 오류)
export async function decryptData(pin: string, salt: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<string> {
  assertBrowser()
  const masterKey = await deriveMasterKey(pin, salt)
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, masterKey, ciphertext as BufferSource)
  return new TextDecoder().decode(buf)
}

// Uint8Array ↔ base64 변환 (IndexedDB 저장 시 직렬화용)
export function u8ToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}

export function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}
