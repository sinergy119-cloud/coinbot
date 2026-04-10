'use client'

import { X } from 'lucide-react'

interface GuideItem {
  name: string
  desc: string
  sub?: string
}

interface GuideSection {
  title: string
  items: GuideItem[]
}

const SECTIONS: GuideSection[] = [
  {
    title: '🔝 헤더 메뉴',
    items: [
      {
        name: '⚙ 계정 설정',
        desc: '내 정보(이름 · 전화 · 이메일 · 텔레그램) 수정 및 비밀번호 변경',
      },
      {
        name: '💬 문의',
        desc: '오류 신고 · 기능 개선 · 일반 문의를 등록',
        sub: '답변이 등록되면 텔레그램으로 즉시 알림',
      },
      {
        name: '🏦 거래소 등록',
        desc: '5개 거래소 API 키를 등록하여 자동 거래 준비',
      },
    ],
  },
  {
    title: '🎁 진행 중인 이벤트',
    items: [
      {
        name: '에어드랍 이벤트 안내',
        desc: '관리자가 등록한 거래소별 이벤트',
        sub: '이벤트 신청 필요 여부, API 거래 허용 여부, 금액 · 기간 · 링크',
      },
    ],
  },
  {
    title: '📑 메인 메뉴',
    items: [
      {
        name: '1️⃣ 거래 실행',
        desc: '지금 바로 거래 실행',
        sub: '거래소 → 코인 → 매수/매도/매수&매도 → 금액 → 계정 선택',
      },
      {
        name: '2️⃣ 스케줄',
        desc: '예약 거래 등록 (기간 + 시간)',
        sub: '매일 지정 시간에 자동 실행 · 수정/삭제 가능',
      },
      {
        name: '3️⃣ 나의 자산',
        desc: '거래소별 KRW 잔고 + 보유 코인 평가금액 실시간 조회',
      },
      {
        name: '4️⃣ 거래 내역',
        desc: '실행 로그 (7/14/30일 필터) + 거래소 거래 내역',
        sub: '성공/실패 통계와 비용 추적',
      },
    ],
  },
]

export default function UserGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">📖 MyCoinBot 사용 가이드</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 mb-2">
                {section.title}
              </div>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.name}
                    className="relative border-l-2 border-gray-200 pl-3 pb-1"
                  >
                    <span className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-blue-500" />
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
                    {item.sub && (
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed whitespace-pre-line">
                        {item.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 참고사항 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800 mb-1.5">📌 참고사항</p>
            <p className="text-[11px] text-amber-700 leading-relaxed break-keep">
              • <b>텔레그램</b> Chat ID를 등록하면 <b>스케줄 정보와 거래 결과</b>를 실시간 알림으로 받을 수 있어요. 😊<br />
              • <b>시장가 거래</b>만 가능해요. (지정가 X)
            </p>
          </div>

          {/* 추가 문의 안내 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
            <p className="text-[11px] text-blue-700">
              💡 더 궁금하신 점이 있으신가요?<br />
              <b>💬 문의</b> 버튼으로 언제든 물어보세요!
            </p>
          </div>
        </div>

        {/* 하단 닫기 */}
        <div className="p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
