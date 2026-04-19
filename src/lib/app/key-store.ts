// 앱 로컬 키 저장 (IndexedDB)
// design-security.md §1-1
//
// IndexedDB 스토어 구조:
//   DB:  coinbot_secure_store
//   - keys store: 거래소 API Key 암호문
//   - meta store: salt, pinHash (PIN 검증용), 기타 설정

'use client'

import { encryptData, decryptData, hashPin, constantTimeEqual, generateSalt, b64ToU8, u8ToB64 } from './crypto-client'
import type { Exchange } from '@/types/database'

const DB_NAME = 'coinbot_secure_store'
const DB_VERSION = 1
const STORE_KEYS = 'keys'
const STORE_META = 'meta'

interface KeyRow {
  id: string              // 예: 'bithumb_main'
  exchange: Exchange
  label: string
  iv: string              // base64
  ciphertext: string      // base64 (JSON {accessKey, secretKey})
  createdAt: string
}

interface MetaRow {
  id: 'meta'
  salt: string            // base64
  pinHash: string         // base64
  failureCount: number
  lockedUntil: number | null   // epoch ms
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' })
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
}

// 전체 초기화 (PIN 분실 시)
export async function resetAll(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_KEYS, STORE_META], 'readwrite')
    t.objectStore(STORE_KEYS).clear()
    t.objectStore(STORE_META).clear()
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

// 모든 키를 특정 PIN으로 일괄 복호화 (실행 시)
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
  return results.filter((r): r is NonNullable<typeof r> => r !== null)
}
