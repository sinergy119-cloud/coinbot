export const metadata = {
  title: '계정 삭제 안내 | MyCoinBot',
}

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-white px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">계정 삭제 안내</h1>
      <p className="text-sm text-gray-600 mb-8">MyCoinBot · 브로솔루션</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8 break-keep">
        MyCoinBot 계정을 삭제하면 등록된 모든 개인정보 및 서비스 데이터가 즉시 삭제됩니다.
        계정 삭제는 앱 내에서 직접 진행하거나, 앱 접근이 불가한 경우 이메일로 요청하실 수 있습니다.
      </p>

      <Section title="앱 내에서 계정 삭제하는 방법">
        <ol className="space-y-3 text-sm text-gray-700 break-keep">
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>MyCoinBot 앱을 실행하고 로그인합니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>하단 탭에서 <b>내 정보</b>를 탭합니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>하단의 <b>회원탈퇴</b> 버튼을 탭합니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>확인 모달에서 <b>탈퇴하기</b>를 탭하면 계정이 즉시 삭제됩니다.</span>
          </li>
        </ol>
        <p className="mt-4 text-xs text-gray-600 break-keep bg-gray-50 rounded-lg p-3">
          ※ 활성 자동매수 스케줄이 있는 경우 탈퇴가 제한됩니다. 스케줄 탭에서 모든 스케줄을 삭제한 후 다시 시도해주세요.
        </p>
      </Section>

      <Section title="삭제되는 데이터">
        <p className="text-sm text-gray-700 break-keep mb-3">
          회원탈퇴 시 아래 데이터가 <b>즉시 영구 삭제</b>됩니다.
        </p>
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          {[
            '계정 정보 (소셜 고유 ID, 닉네임, 이메일)',
            '등록된 거래소 API 키 (암호화 저장 데이터 포함)',
            '텔레그램 Chat ID 등 알림 설정',
            '로그인 이력',
            '문의 내역',
            '알림 설정 및 알림 내역',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="shrink-0 text-red-500 font-bold">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-600 break-keep bg-gray-50 rounded-lg p-3">
          ※ 통신비밀보호법에 따라 접속 로그·IP 정보는 3개월간 보관 후 파기됩니다.
          그 외 모든 개인정보는 탈퇴 즉시 복구 불가능한 방법으로 삭제됩니다.
        </p>
      </Section>

      <Section title="앱 접근이 불가한 경우 이메일로 삭제 요청">
        <p className="text-sm text-gray-700 break-keep mb-4">
          앱을 사용할 수 없는 상황이라면 아래 이메일로 계정 삭제를 요청해 주세요.
          요청 접수 후 <b>영업일 3일 이내</b>에 처리하고 결과를 회신드립니다.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">문의 이메일</p>
          <a
            href="mailto:sinergy119@gmail.com"
            className="text-blue-600 font-medium text-sm underline"
          >
            sinergy119@gmail.com
          </a>
          <p className="text-xs text-gray-600 mt-3 break-keep">
            이메일 제목: <b>[계정 삭제 요청] MyCoinBot</b><br />
            본문에 가입 시 사용한 구글 또는 카카오 이메일 주소를 포함해 주세요.
          </p>
        </div>
      </Section>

      <div className="mt-10 pt-6 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-600">브로솔루션 · MyCoinBot</p>
        <a href="/privacy" className="text-xs text-blue-600 underline mt-1 inline-block">
          개인정보처리방침 보기
        </a>
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
