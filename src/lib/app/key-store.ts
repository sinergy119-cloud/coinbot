'use client'

// 앱 로컬 키 저장 (IndexedDB)
// design-security.md §1-1
//
// IndexedDB 스토어 구조:
//   DB:  coinbot_secure_store  (version 2)
//   - keys       : 거래소 API Key 암호문 (PIN 기반 AES-GCM)
//   - meta       : salt, pinHash, deviceKey(JWK) 등
//   - auto_keys  : SW 자동 실행용 복사본 (device key 기반 AES-GCM, PIN 불필요)

import { encryptData, decryptData, hashPin, constantTimeEqual, generateSalt, b64ToU8, u8ToB64 } from './crypto-client'
import type { Exchange } from '@/types/database'

const DB_NAME = 'coinbot_secure_store'
const DB_VERSION = 2
const STORE_KEYS = 'keys'
const STORE_META = 'meta'
const STORE_AUTO = 'auto_keys'

interface KeyRow {
  id: string              // 예: 'bithumb_main'
  exchange: Exchange
  label: string
  iv: string              // base64
  ciphertext: string      // base64 (JSON {accessKey, secretKey})
  createdAt: string
}

interface AutoKeyRow {
  id: string              // KeyRow.id 와 동일
  exchange: Exchange
  label: string
  iv: string              // base64 (device key 암호화용 IV)
  ciphertext: string      // base64 (device key로 암호화된 {accessKey, secretKey})
}

interface MetaRow {
  id: 'meta'
  salt: string            // base64
  pinHash: string         // base64
  failureCount: number
  lockedUntil: number | null   // epoch ms
  deviceKey?: JsonWebKey  // SW 자동 실행용 기기 AES 키 (JWK)
  // 생체 인증(WebAuthn) 필드
  biometricCredentialId?: string  // base64 encoded WebAuthn credential ID
  bioKeyJwk?: JsonWebKey          // PIN 암호화용 AES-256 키 (JWK)
  biometricPin?: string           // bioKey로 암호화된 PIN (base64)
  biometricPinIv?: string         // IV (base64)
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_AUTO)) db.createObjectStore(STORE_AUTO, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const req = run(s)
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function isPinSet(): Promise<boolean> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  return !!meta
}

// 최초 PIN 설정
export async function setupPin(pin: string): Promise<void> {
  if (pin.length < 6) throw new Error('PIN은 최소 6자리여야 합니다.')
  const salt = generateSalt()
  const pinHash = await hashPin(pin, salt)
  const meta: MetaRow = {
    id: 'meta',
    salt: u8ToB64(salt),
    pinHash: u8ToB64(pinHash),
    failureCount: 0,
    lockedUntil: null,
  }
  await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put(meta))
}

export async function verifyPin(pin: string): Promise<{ ok: boolean; reason?: 'locked' | 'bad_pin' | 'no_meta'; retryAfterMs?: number }> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) return { ok: false, reason: 'no_meta' }
  const now = Date.now()
  if (meta.lockedUntil && now < meta.lockedUntil) {
    return { ok: false, reason: 'locked', retryAfterMs: meta.lockedUntil - now }
  }
  const salt = b64ToU8(meta.salt)
  const pinHash = await hashPin(pin, salt)
  const stored = b64ToU8(meta.pinHash)
  if (!constantTimeEqual(pinHash, stored)) {
    // 실패 카운트 증가
    const next: MetaRow = { ...meta, failureCount: meta.failureCount + 1 }
    if (next.failureCount >= 3) {
      next.lockedUntil = now + 10 * 60 * 1000 // 10분 잠금
      next.failureCount = 0
    }
    await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put(next))
    return { ok: false, reason: 'bad_pin' }
  }
  // 성공 → 카운터 리셋
  if (meta.failureCount > 0 || meta.lockedUntil) {
    await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put({ ...meta, failureCount: 0, lockedUntil: null }))
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────
// Device Key 관리 (SW 자동 실행용 — PIN 불필요)
// ─────────────────────────────────────────────────────────────

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)

  if (meta?.deviceKey) {
    return crypto.subtle.importKey('jwk', meta.deviceKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }

  // 새 device key 생성
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const jwk = await crypto.subtle.exportKey('jwk', key)

  const updatedMeta: MetaRow = meta
    ? { ...meta, deviceKey: jwk }
    : { id: 'meta', salt: '', pinHash: '', failureCount: 0, lockedUntil: null, deviceKey: jwk }
  await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put(updatedMeta))

  return key
}

// auto_keys 스토어에 복사본 저장 (fire-and-forget 용도 — 실패해도 무시)
async function saveAutoKey(id: string, exchange: Exchange, label: string, accessKey: string, secretKey: string): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey()
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const plaintext = new TextEncoder().encode(JSON.stringify({ accessKey, secretKey }))
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, plaintext)
  const row: AutoKeyRow = {
    id,
    exchange,
    label,
    iv: u8ToB64(iv),
    ciphertext: u8ToB64(new Uint8Array(ciphertextBuf)),
  }
  await tx<IDBValidKey>(STORE_AUTO, 'readwrite', (s) => s.put(row))
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

// 키 등록 (PIN 검증은 호출 측에서 사전 수행)
export async function saveKey(pin: string, exchange: Exchange, label: string, accessKey: string, secretKey: string): Promise<string> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) throw new Error('PIN이 설정되지 않았습니다.')
  const salt = b64ToU8(meta.salt)
  const plaintext = JSON.stringify({ accessKey, secretKey })
  const { iv, ciphertext } = await encryptData(pin, salt, plaintext)
  const id = `${exchange.toLowerCase()}_${Date.now().toString(36)}`
  const row: KeyRow = {
    id,
    exchange,
    label: label.slice(0, 50),
    iv: u8ToB64(iv),
    ciphertext: u8ToB64(ciphertext),
    createdAt: new Date().toISOString(),
  }
  await tx<IDBValidKey>(STORE_KEYS, 'readwrite', (s) => s.put(row))

  // SW 자동 실행용 device-key 암호화 복사본 저장 (PIN 불필요)
  saveAutoKey(id, exchange, label, accessKey, secretKey).catch(() => {})

  return id
}

// 키 목록 (평문은 반환하지 않음 — label, exchange, createdAt만)
export async function listKeys(): Promise<Array<{ id: string; exchange: Exchange; label: string; createdAt: string }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_KEYS, 'readonly')
    const s = t.objectStore(STORE_KEYS)
    const req = s.getAll()
    req.onsuccess = () => {
      const rows = (req.result as KeyRow[]) ?? []
      resolve(rows.map((r) => ({ id: r.id, exchange: r.exchange, label: r.label, createdAt: r.createdAt })))
    }
    req.onerror = () => reject(req.error)
  })
}

// 키 복호화 (PIN 검증 선행 필요)
export async function decryptKey(pin: string, id: string): Promise<{ exchange: Exchange; label: string; accessKey: string; secretKey: string }> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) throw new Error('PIN이 설정되지 않았습니다.')
  const row = await tx<KeyRow | undefined>(STORE_KEYS, 'readonly', (s) => s.get(id) as IDBRequest<KeyRow | undefined>)
  if (!row) throw new Error('키를 찾을 수 없습니다.')
  const salt = b64ToU8(meta.salt)
  const iv = b64ToU8(row.iv)
  const ciphertext = b64ToU8(row.ciphertext)
  const plaintext = await decryptData(pin, salt, iv, ciphertext)
  const { accessKey, secretKey } = JSON.parse(plaintext)
  return { exchange: row.exchange, label: row.label, accessKey, secretKey }
}

export async function deleteKey(id: string): Promise<void> {
  await tx<undefined>(STORE_KEYS, 'readwrite', (s) => s.delete(id))
  // auto_keys 복사본도 함께 삭제
  tx<undefined>(STORE_AUTO, 'readwrite', (s) => s.delete(id)).catch(() => {})
}

// 전체 초기화 (PIN 분실 시)
export async function resetAll(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_KEYS, STORE_META, STORE_AUTO], 'readwrite')
    t.objectStore(STORE_KEYS).clear()
    t.objectStore(STORE_META).clear()
    t.objectStore(STORE_AUTO).clear()
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

// ─────────────────────────────────────────────────────────────
// 생체 인증 (WebAuthn Platform Authenticator)
// ─────────────────────────────────────────────────────────────

/** 생체 인증(지문/Face ID) 지원 여부 확인 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** 생체 인증 등록 여부 확인 */
export async function isBiometricRegistered(): Promise<boolean> {
  try {
    const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
    return !!(meta?.biometricCredentialId && meta?.bioKeyJwk && meta?.biometricPin)
  } catch {
    return false
  }
}

/** 생체 인증 등록 — PIN을 생체 인증으로 보호 */
export async function registerBiometric(pin: string): Promise<void> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) throw new Error('PIN이 설정되지 않았습니다.')

  // 1. WebAuthn 플랫폼 인증자(지문/Face ID) 등록
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'MyCoinBot', id: window.location.hostname },
      user: { id: userId, name: 'coinbot-user', displayName: 'CoinBot' },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('생체 인증 등록에 실패했습니다.')

  // 2. PIN → AES-GCM 암호화
  const bioKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const pinBuf = new TextEncoder().encode(pin)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, bioKey, pinBuf)
  const bioKeyJwk = await crypto.subtle.exportKey('jwk', bioKey)

  // 3. IndexedDB meta에 저장
  const updated: MetaRow = {
    ...meta,
    biometricCredentialId: u8ToB64(new Uint8Array(credential.rawId)),
    bioKeyJwk,
    biometricPin: u8ToB64(new Uint8Array(ciphertext)),
    biometricPinIv: u8ToB64(iv),
  }
  await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put(updated))
}

/** 생체 인증 실행 → PIN 반환 */
export async function authenticateWithBiometric(): Promise<string> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta?.biometricCredentialId || !meta?.bioKeyJwk || !meta?.biometricPin || !meta?.biometricPinIv) {
    throw new Error('생체 인증이 등록되지 않았습니다.')
  }

  // WebAuthn assertion (지문/Face ID 프롬프트)
  const bioChallenge = new Uint8Array(32)
  crypto.getRandomValues(bioChallenge)
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: bioChallenge.buffer as ArrayBuffer,
      allowCredentials: [{ id: b64ToU8(meta.biometricCredentialId).buffer as ArrayBuffer, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('생체 인증에 실패했습니다.')

  // PIN 복호화
  const bioKey = await crypto.subtle.importKey(
    'jwk', meta.bioKeyJwk, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  )
  const pinIv = b64ToU8(meta.biometricPinIv)
  const pinCipher = b64ToU8(meta.biometricPin)
  const pinBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: pinIv.buffer as ArrayBuffer },
    bioKey,
    pinCipher.buffer as ArrayBuffer,
  )
  return new TextDecoder().decode(pinBuf)
}

/** 생체 인증 해제 */
export async function removeBiometric(): Promise<void> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) return
  const updated: MetaRow = { ...meta }
  delete updated.biometricCredentialId
  delete updated.bioKeyJwk
  delete updated.biometricPin
  delete updated.biometricPinIv
  await tx<IDBValidKey>(STORE_META, 'readwrite', (s) => s.put(updated))
}

// 모든 키를 특정 PIN으로 일괄 복호화 (실행 시)
// 복호화 성공 시 auto_keys 복사본도 업서트 (기존 키 자동 마이그레이션)
export async function decryptAllByIds(pin: string, ids: string[]): Promise<Array<{ id: string; exchange: Exchange; label: string; accessKey: string; secretKey: string }>> {
  const meta = await tx<MetaRow | undefined>(STORE_META, 'readonly', (s) => s.get('meta') as IDBRequest<MetaRow | undefined>)
  if (!meta) throw new Error('PIN이 설정되지 않았습니다.')
  const salt = b64ToU8(meta.salt)

  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await tx<KeyRow | undefined>(STORE_KEYS, 'readonly', (s) => s.get(id) as IDBRequest<KeyRow | undefined>)
      if (!row) return null
      const plaintext = await decryptData(pin, salt, b64ToU8(row.iv), b64ToU8(row.ciphertext))
      const { accessKey, secretKey } = JSON.parse(plaintext)
      return { id: row.id, exchange: row.exchange, label: row.label, accessKey, secretKey }
    }),
  )

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)

  // 기존 키도 auto_keys에 등록 (첫 PIN 사용 시 자동 마이그레이션, fire-and-forget)
  Promise.all(
    valid.map((r) => saveAutoKey(r.id, r.exchange, r.label, r.accessKey, r.secretKey))
  ).catch(() => {})

  return valid
}
