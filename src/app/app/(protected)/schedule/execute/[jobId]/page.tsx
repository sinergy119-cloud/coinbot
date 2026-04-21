'use client'

// FCM 푸시 딥링크 실행 페이지
// /app/schedule/execute/[jobId]?date=YYYY-MM-DD
//
// 흐름:
//   1. FCM 수신 → 사용자 알림 탭 → 이 페이지 진입
//   2. PIN 입력 → 복호화
//   3. /api/app/proxy/execute 호출
//   4. /api/app/trade-jobs/[id]/report 로 결과 보고
//   5. 성공/실패 표시

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import PinPad from '../../../../_components/PinPad'
import KeySelector from '../../../../_components/KeySelector'
import { verifyPin, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

interface JobDetail {
  id: string
  exchange: Exchange
  coin: string
  tradeType: TradeType
  amountKrw: number
  scheduleFrom: string
  scheduleTo: string
  scheduleTime: string
  status: string
  lastExecutedAt: string | null
  isAppJob: boolean
}

interface ProxyResult {
  exchange: string
  coin: string
  tradeType: string
  balanceBefore: number
  balance: number
  executedAt: string
}

type Phase = 'loading' | 'need_keys' | 'select_keys' | 'pin' | 'executing' | 'success' | 'failed' | 'not_found'

function ExecuteInner() {
  const params = useParams<{ jobId: string }>()
  const search = useSearchParams()
  const router = useRouter()

  const jobId = params.jobId
  const executionDate = search.get('date') ?? new Date().toISOString().slice(0, 10)

  const [phase, setPhase] = useState<Phase>('loading')
  const [job, setJob] = useState<JobDetail | null>(null)
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>([])
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ProxyResult | null>(null)
  const [failReason, setFailReason] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/app/trade-jobs')
        const json = await res.json()
        if (!json.ok) {
          setPhase('not_found')
          return
        }
        const found = (json.data.items as JobDetail[]).find((j) => j.id === jobId)
        if (!found) {
          setPhase('not_found')
          return
        }
        setJob(found)
        setPhase('select_keys')
      } catch {
        setPhase('not_found')
      }
    })()
  }, [jobId])

  async function handlePin(pin: string) {
    if (!job) return
    setSubmitting(true)
    setPinError(null)
    try {
      const v = await verifyPin(pin)
      if (!v.ok) {
        if (v.reason === 'locked') {
          const min = Math.ceil((v.retryAfterMs ?? 0) / 60000)
          setPinError(`잠금 상태입니다. ${min}분 후 재시도.`)
        } else {
          setPinError('PIN이 틀립니다.')
        }
        return
      }

      const decrypted = await decryptAllByIds(pin, selectedKeyIds)
      if (decrypted.length === 0) {
        setPinError('선택한 계정을 찾을 수 없습니다.')
        return
      }

      setPhase('executing')

      // 계정별 순차 실행 + 첫 성공/실패로 보고 (스케줄 실행은 단일 보고)
      let anyOk = false
      let lastError: string | null = null
      let lastResult: ProxyResult | null = null

      for (const acc of decrypted) {
        try {
          const res = await fetch('/api/app/proxy/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exchange: job.exchange,
              coin: job.coin,
              tradeType: job.tradeType,
              amountKrw: job.amountKrw,
              accessKey: acc.accessKey,
              secretKey: acc.secretKey,
            }),
          })
          const json = await res.json()
          if (json.ok) {
            anyOk = true
            lastResult = json.data
          } else {
            lastError = json.error ?? '실행 실패'
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : '네트워크 오류'
        }
      }

      // 서버에 결과 보고 (중복 방지 락 포함)
      await fetch(`/api/app/trade-jobs/${jobId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionDate,
          result: anyOk ? 'success' : 'fail',
          deviceEndpoint: null,
          errorMessage: anyOk ? null : lastError,
        }),
      })

      if (anyOk && lastResult) {
        setResult(lastResult)
        setPhase('success')
      } else {
        setFailReason(lastError)
        setPhase('failed')
      }
    } catch (err) {
      setFailReason(err instanceof Error ? err.message : '오류')
      setPhase('failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'loading') return <div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>

  if (phase === 'not_found') {
    return (
      <div className="p-8 text-center break-keep">
        <p className="text-2xl mb-3">😕</p>
        <p className="text-base font-semibold text-gray-900">스케줄을 찾을 수 없습니다.</p>
        <p className="text-sm text-gray-700 mt-2">이미 취소되었거나 잘못된 링크일 수 있어요.</p>
        <button
          type="button"
          onClick={() => router.push('/app/schedule')}
          className="mt-4 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
        >
          스케줄 목록
        </button>
      </div>
    )
  }

  if (phase === 'select_keys' && job) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        <header className="break-keep">
          <h1 className="text-xl font-bold text-gray-900">스케줄 거래 실행</h1>
          <p className="text-sm text-gray-700 mt-1">
            {EXCHANGE_LABELS[job.exchange]} · {TRADE_TYPE_LABELS[job.tradeType]} · {job.coin}
            {job.tradeType !== 'SELL' && ` · ${job.amountKrw.toLocaleString()}원`}
          </p>
        </header>

        <div>
          <label className="text-xs text-gray-700 font-semibold">실행할 계정 선택</label>
          <div className="mt-1">
            <KeySelector exchange={job.exchange} multi={true} value={selectedKeyIds} onChange={setSelectedKeyIds} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (selectedKeyIds.length === 0) { alert('계정을 하나 이상 선택하세요.'); return }
            setPhase('pin')
          }}
          className="bg-gray-900 text-white py-3 rounded-2xl text-sm font-semibold"
        >
          PIN 입력 후 실행
        </button>
      </div>
    )
  }

  if (phase === 'pin') {
    return (
      <PinPad
        title="PIN 입력"
        description="스케줄 거래 실행을 위해 PIN을 입력해주세요."
        errorMessage={pinError}
        onSubmit={handlePin}
        onCancel={() => setPhase('select_keys')}
        submitting={submitting}
      />
    )
  }

  if (phase === 'executing') {
    return (
      <div className="p-8 text-center">
        <p className="text-3xl">⏳</p>
        <p className="text-sm text-gray-900 font-semibold mt-3">거래 실행 중...</p>
        <p className="text-xs text-gray-600 mt-1 break-keep">잠시만 기다려주세요.</p>
      </div>
    )
  }

  if (phase === 'success' && result) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8 break-keep">
        <p className="text-4xl">✅</p>
        <h2 className="text-xl font-bold text-gray-900">거래 성공</h2>
        <div className="bg-white rounded-2xl p-5 w-full">
          <InfoRow label="거래소" value={EXCHANGE_LABELS[result.exchange as Exchange] ?? result.exchange} />
          <InfoRow label="코인" value={result.coin} />
          <InfoRow label="방식" value={TRADE_TYPE_LABELS[result.tradeType as TradeType] ?? result.tradeType} />
          <InfoRow label="이전 잔액" value={`${Math.floor(result.balanceBefore).toLocaleString()}원`} />
          <InfoRow label="현재 잔액" value={`${Math.floor(result.balance).toLocaleString()}원`} />
          <InfoRow label="실행 시각" value={new Date(result.executedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} />
        </div>
        <button
          type="button"
          onClick={() => router.push('/app/schedule')}
          className="bg-gray-900 text-white py-3 px-6 rounded-2xl text-sm font-semibold"
        >
          스케줄 목록
        </button>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8 break-keep">
        <p className="text-4xl">❌</p>
        <h2 className="text-xl font-bold text-gray-900">거래 실패</h2>
        {failReason && (
          <div className="bg-red-50 rounded-2xl p-4 w-full">
            <p className="text-sm text-red-700 break-keep">{failReason}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => router.push('/app/schedule')}
          className="bg-gray-900 text-white py-3 px-6 rounded-2xl text-sm font-semibold"
        >
          스케줄 목록
        </button>
      </div>
    )
  }

  return null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 font-medium break-keep">{value}</span>
    </div>
  )
}

export default function ExecutePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>}>
      <ExecuteInner />
    </Suspense>
  )
}
