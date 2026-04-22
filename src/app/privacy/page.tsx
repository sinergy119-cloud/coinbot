export const metadata = {
  title: '개인정보처리방침 | MyCoinBot',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-600 mb-8">시행일: 2025년 4월 1일 · 최종 수정일: 2026년 4월 22일</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8 break-keep">
        브로솔루션(이하 "회사")이 운영하는 MyCoinBot 서비스(이하 "서비스")는 이용자의 개인정보를 소중히 여기며,
        「개인정보 보호법」 및 관련 법령을 준수합니다.
        본 방침은 서비스 이용과 관련하여 수집·이용·보관·파기되는 개인정보에 대한 사항을 안내합니다.
      </p>

      <Section title="제1조 수집하는 개인정보 항목 및 수집 방법">
        <p className="mb-3 text-sm text-gray-700 break-keep">회사는 소셜 로그인(카카오·네이버·구글) 시 아래 항목을 수집합니다.</p>
        <table className="w-full text-sm border-collapse mb-3">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">구분</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">수집 항목</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">수집 방법</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">필수</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소셜 고유 ID, 닉네임(이름), 이메일 주소</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소셜 로그인 API 연동</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">자동 수집</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 접속 IP, 접속 일시, 기기 정보(User-Agent), 로그인 이력</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 이용 과정 자동 생성</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">선택</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">텔레그램 Chat ID, 전화번호</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">이용자 직접 입력</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-600 break-keep">※ 거래소 API Key(앱 서비스)는 서버로 전송되지 않으며, AES-256-GCM 방식으로 암호화되어 사용자 기기(IndexedDB)에만 저장됩니다.</p>
      </Section>

      <Section title="제2조 개인정보의 수집·이용 목적">
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">①</span><span><b>회원 식별 및 서비스 제공:</b> 소셜 고유 ID·닉네임으로 회원을 식별하고, 로그인 없이 타 기기 접근을 방지합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">②</span><span><b>알림 발송:</b> 이메일·텔레그램을 통해 거래 결과, 신규 이벤트, 스케줄 알림 등 서비스 중요 정보를 발송합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">③</span><span><b>거래 실행:</b> 이용자가 등록한 거래소 API Key를 기반으로 자동 매수 서비스를 제공합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">④</span><span><b>보안 및 부정 이용 방지:</b> 접속 IP·로그인 이력을 통해 비정상 접근을 탐지하고 계정을 보호합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">⑤</span><span><b>고객 문의 처리:</b> 서비스 이용 관련 문의·불만 처리에 활용합니다.</span></li>
        </ul>
      </Section>

      <Section title="제3조 개인정보의 보유 및 이용 기간">
        <p className="text-sm text-gray-700 break-keep mb-3">
          이용자의 개인정보는 회원 탈퇴 시까지 보유하며, 탈퇴 즉시 지체 없이 파기합니다.
          단, 관련 법령에 따라 아래 항목은 해당 기간 동안 보관합니다.
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">항목</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">근거 법령</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">접속 로그, IP 정보</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">통신비밀보호법</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">3개월</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소비자 불만·분쟁 기록</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">전자상거래법</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">3년</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="제4조 개인정보의 제3자 제공">
        <p className="text-sm text-gray-700 break-keep">
          회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.
          다만, 다음의 경우는 예외로 합니다.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="제5조 개인정보 처리의 위탁">
        <p className="text-sm text-gray-700 break-keep mb-3">회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다.</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">수탁업체</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">Amazon Web Services (AWS)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서버 인프라 운영 및 데이터 저장</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">Supabase Inc.</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">데이터베이스 관리 및 인증</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">Google Firebase</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">푸시 알림(FCM) 발송</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="제6조 개인정보의 파기 절차 및 방법">
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          <li><b>파기 절차:</b> 목적 달성 후 내부 방침 및 관련 법령에 따라 일정 기간 보관 후 파기합니다.</li>
          <li><b>파기 방법:</b> 전자적 파일 형태는 복구 불가능한 방법으로 영구 삭제하며, 출력물은 파쇄 또는 소각합니다.</li>
          <li><b>거래소 API Key:</b> 앱 서비스에서 사용자 기기에만 저장되며, 회원 탈퇴 또는 앱 데이터 삭제 시 기기에서 즉시 삭제됩니다.</li>
        </ul>
      </Section>

      <Section title="제7조 이용자의 권리와 행사 방법">
        <p className="text-sm text-gray-700 break-keep mb-2">이용자는 언제든지 아래 권리를 행사할 수 있습니다.</p>
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>개인정보 열람·수정·삭제 요청</li>
          <li>개인정보 처리 정지 요청</li>
          <li>회원 탈퇴를 통한 개인정보 전체 삭제 (앱 내 [내 정보] → [회원탈퇴])</li>
        </ul>
        <p className="text-sm text-gray-700 break-keep mt-2">
          권리 행사는 카카오톡 채널 <b>@mycoinbot</b> 또는 이메일을 통해 요청하실 수 있으며, 회사는 지체 없이 처리합니다.
        </p>
      </Section>

      <Section title="제8조 개인정보 보호를 위한 기술적·관리적 조치">
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>거래소 API Key(앱): AES-256-GCM 암호화 후 기기 로컬(IndexedDB) 저장 — 서버 미전송</li>
          <li>세션: JWT 기반 암호화 쿠키, HTTPS 전송</li>
          <li>접근 제어: 관리자 계정 분리, IP 기반 접근 로그 기록</li>
          <li>정기적 보안 점검 및 취약점 패치</li>
        </ul>
      </Section>

      <Section title="제9조 개인정보 보호책임자">
        <table className="w-full text-sm border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700 w-32">회사명</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">브로솔루션</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700">사업자번호</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">160-07-02158</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700">담당자</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">브로솔루션 개인정보보호 담당자</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700">이메일</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">sinergy119@gmail.com</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700">카카오톡 채널</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">@mycoinbot</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2 break-keep">
          개인정보 침해에 관한 신고·상담은 개인정보분쟁조정위원회(www.kopico.go.kr), 개인정보침해신고센터(privacy.kisa.or.kr)에 문의하실 수 있습니다.
        </p>
      </Section>

      <Section title="제10조 개인정보처리방침의 변경">
        <p className="text-sm text-gray-700 break-keep">
          본 방침은 법령·서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 공지사항을 통해 사전 안내합니다.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-600">브로솔루션 · MyCoinBot · 시행일 2025년 4월 1일</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  )
}
