export const metadata = {
  title: '개인정보처리방침 | MyCoinBot',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-600 mb-8">시행일: 2025년 4월 1일 · 최종 수정일: 2026년 5월 4일</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8 break-keep">
        브로솔루션(이하 &quot;회사&quot;)이 운영하는 MyCoinBot 서비스(이하 &quot;서비스&quot;)는
        이용자의 개인정보를 소중히 여기며,「개인정보 보호법」 및 관련 법령을 준수합니다.
        본 방침은 서비스 이용과 관련하여 수집·이용·보관·파기·이전되는 개인정보에 대한 사항을 안내합니다.
      </p>

      <Section title="제1조 수집하는 개인정보 항목">
        <p className="mb-3 text-sm text-gray-700 break-keep">
          회사는 서비스 제공에 필요한 최소한의 개인정보를 수집합니다. 수집 항목은 저장 위치에 따라
          <b> ① 이용자 기기에만 저장되는 정보</b>와 <b>② 서버에 저장되는 정보</b>로 구분됩니다.
        </p>

        <p className="text-sm font-semibold text-gray-900 mt-4 mb-2">① 이용자 기기에만 저장 (서버 미전송)</p>
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">항목</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">설명</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">거래소 API Key (Access·Secret)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">PIN 기반 AES-256-GCM 암호화 후 IndexedDB 저장</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">PIN 검증값</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">PBKDF2 단방향 해시 — 원문 PIN은 저장하지 않음</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">생체 자격증명 (선택)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">WebAuthn 표준 — 지문·얼굴 데이터는 OS가 보관, 회사는 자격증명 ID만 참조</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm font-semibold text-gray-900 mt-4 mb-2">② 서버 저장</p>
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
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소셜 고유 ID(카카오·네이버·구글), 닉네임, 이메일 주소</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소셜 로그인 API 연동</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">선택</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">텔레그램 Chat ID, 전화번호</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">이용자 직접 입력</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 운영</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">거래 로그(거래소·코인·금액·결과·실패 사유), 스케줄 정보, 알림 메시지·메타데이터</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 이용 과정에서 자동 생성</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">기술적 항목</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">FCM 푸시 토큰(엔드포인트), 접속 IP, 접속 일시, 기기 정보(User-Agent)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">자동 수집</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">관리자 위임 자동 매수 신청 시</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">암호화된 거래소 API Key (이용자가 [내 정보] → [관리자 위임 신청]을 직접 진행한 경우에 한함)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">이용자의 명시적 동의에 따른 등록</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="제2조 개인정보의 수집·이용 목적">
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">①</span><span><b>회원 식별 및 서비스 제공:</b> 소셜 고유 ID·닉네임으로 회원을 식별합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">②</span><span><b>거래 실행:</b> 이용자가 등록한 거래소 API Key로 매수·매도 요청을 거래소에 전달합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">③</span><span><b>자동화된 거래:</b> 이용자가 사전 설정한 스케줄·금액·계정 정보에 따라 자동 매수를 실행합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">④</span><span><b>알림 발송:</b> 거래 결과, 신규 이벤트, 리워드 지급일, 보안 변경 등을 푸시·텔레그램·이메일로 발송합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">⑤</span><span><b>보안 및 부정 이용 방지:</b> 접속 IP·로그인 이력으로 비정상 접근을 탐지합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">⑥</span><span><b>고객 문의 처리:</b> 서비스 이용 관련 문의·불만 처리에 활용합니다.</span></li>
          <li className="flex gap-2"><span className="shrink-0 text-gray-900 font-semibold">⑦</span><span><b>운영 분석(통계):</b> 식별 정보를 제외한 거래 통계로 서비스 안정성을 모니터링합니다.</span></li>
        </ul>
      </Section>

      <Section title="제3조 개인정보의 보유 및 이용 기간">
        <p className="text-sm text-gray-700 break-keep mb-3">
          회사는 회원 탈퇴 시까지 개인정보를 보유하며, 탈퇴 시 지체 없이 파기합니다. 단, 분쟁 대응 및 관련 법령에 따라 아래 항목은 별도 보관합니다.
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">항목</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">근거</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">거래 로그(매수·매도 결과, 금액)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 운영 (회사 내부방침)</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">회원 탈퇴 시까지<br />(탈퇴 후 30일간 회사 내부방침에 따라 별도 보관 후 파기)</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">알림 데이터</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 이용 이력</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">탈퇴 시까지(이용자 직접 삭제 가능)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">FCM 푸시 토큰</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서비스 운영</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">구독 해제 또는 토큰 만료 시까지</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">접속 로그, IP 정보</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">통신비밀보호법</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">3개월</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">소비자 불만·분쟁 기록</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">전자상거래법</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">3년</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2 break-keep">
          ※ 회사는 거래의 직접 당사자가 아닌 매개자로서, 「전자금융거래법」 §22 및 「전자상거래법」 §6의 거래기록 보관 의무 적용 대상이 아닙니다.
          실제 거래기록은 거래소(빗썸·업비트·코인원·코빗·고팍스)에 별도로 5년간 보관됩니다.
        </p>
        <p className="text-xs text-gray-600 mt-1 break-keep">
          ※ 개인을 식별할 수 없도록 처리된 익명 통계 데이터는 운영 분석 목적으로 기간 제한 없이 보존될 수 있습니다.
        </p>
      </Section>

      <Section title="제4조 개인정보의 제3자 제공">
        <p className="text-sm text-gray-700 break-keep">
          회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나 수사기관의 적법한 요청이 있는 경우</li>
        </ul>
      </Section>

      <Section title="제5조 개인정보의 국외 이전">
        <p className="text-sm text-gray-700 break-keep mb-3">
          회사는 「개인정보 보호법」 §28-8에 따라 안정적인 서비스 제공을 위해 아래와 같이 일부 개인정보를 국외에 이전합니다.
        </p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left text-gray-700">이전받는 자<br />(연락처)</th>
              <th className="border border-gray-300 px-2 py-2 text-left text-gray-700">국가</th>
              <th className="border border-gray-300 px-2 py-2 text-left text-gray-700">이전 항목</th>
              <th className="border border-gray-300 px-2 py-2 text-left text-gray-700">이용 목적</th>
              <th className="border border-gray-300 px-2 py-2 text-left text-gray-700">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">Supabase Inc.<br />(privacy@supabase.io)</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">싱가포르</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">회원 식별정보, 거래 로그, 알림, 스케줄</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">DB·인증 호스팅</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">위탁 종료 시까지</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-2 py-2 text-gray-700">Google LLC (Firebase)<br />(support-kr@google.com)</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">미국</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">FCM 푸시 토큰, 푸시 페이로드</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">푸시 알림 발송</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">구독 해제 시까지</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">Telegram Group Inc.<br />(dmca@telegram.org)</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">영국령 버진아일랜드 / UAE</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">텔레그램 Chat ID, 메시지 본문</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">텔레그램 알림 발송 (선택 가입자)</td>
              <td className="border border-gray-300 px-2 py-2 text-gray-700">구독 해제 시까지</td>
            </tr>
          </tbody>
        </table>
        <ul className="text-xs text-gray-600 mt-3 space-y-1 break-keep list-disc pl-5">
          <li><b>이전 일시·방법:</b> 이용자가 서비스를 이용하는 시점에 TLS 1.2 이상으로 암호화하여 인터넷 회선을 통해 전송합니다.</li>
          <li><b>거부 권리·방법·효과:</b> 이용자는 가입 시 또는 [내 정보 → 알림 설정]에서 국외 이전을 거부할 수 있습니다. 거부 시 푸시 알림·텔레그램 알림·서버 데이터 동기화가 제한되어 정상적인 서비스 이용이 어려울 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제6조 개인정보 처리의 위탁">
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
              <td className="border border-gray-300 px-3 py-2 text-gray-700">Amazon Web Services (AWS) — 서울 리전</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-700">서버 인프라 운영</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2 break-keep">
          국외 수탁업체(Supabase, Firebase, Telegram)는 제5조 국외 이전 조항을 따릅니다.
          소셜 로그인 제공자(카카오·네이버·구글)는 위탁이 아닌 외부 인증 서비스로, 이용자가 직접 해당 제공자에 인증 후 그 결과를
          회사가 받습니다(제7조).
        </p>
      </Section>

      <Section title="제7조 외부 인증 서비스 (소셜 로그인)">
        <p className="text-sm text-gray-700 break-keep mb-2">
          회사는 회원 식별 편의를 위해 아래 외부 인증 서비스를 제공합니다. 이용자는 해당 제공자에 직접 로그인한 후
          제공자가 회사에 전달하는 정보를 통해 가입·로그인합니다.
        </p>
        <ul className="text-sm text-gray-700 break-keep list-disc pl-5 space-y-1">
          <li><b>카카오:</b> 카카오 고유 ID, 닉네임, 이메일</li>
          <li><b>네이버:</b> 네이버 고유 ID, 닉네임, 이메일</li>
          <li><b>구글:</b> 구글 고유 ID, 닉네임, 이메일</li>
        </ul>
        <p className="text-xs text-gray-600 mt-2 break-keep">
          각 제공자의 개인정보 처리 정책은 카카오·네이버·구글의 정책을 따릅니다.
        </p>
      </Section>

      <Section title="제8조 거래소 API 연동">
        <p className="text-sm text-gray-700 break-keep mb-2">
          회사는 이용자가 등록한 거래소 API Key로 아래 거래소에 매수·매도·잔고 조회 요청을 전달하는 <b>매개자</b> 역할을 수행합니다.
          거래의 직접 당사자는 이용자와 거래소이며, 회사는 거래 결과에 대한 직접적 책임을 지지 않습니다.
        </p>
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5 mb-2">
          <li>빗썸, 업비트, 코인원, 코빗, 고팍스 (TLS 1.2+ 암호화 통신)</li>
        </ul>
        <p className="text-sm text-gray-700 break-keep">
          이용자는 거래소 API Key 발급 시 <b>입출금 권한을 반드시 제외</b>하고 매수·매도·조회 권한만 허용해야 합니다.
          API Key는 원칙적으로 이용자 기기에만 저장되며(제1조 ①), 관리자 위임 자동 매수 신청 시에 한해 AES-256-GCM으로 서버에 암호화 저장됩니다.
        </p>
      </Section>

      <Section title="제9조 자동화된 의사결정">
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          <li>회사는 이용자가 <b>사전에 직접 등록한</b> 스케줄·금액·계정·실행 시각에 따라서만 자동 매수를 실행합니다.</li>
          <li>이용자 프로파일링이나 자동 신용평가 등 알고리즘 의사결정은 사용하지 않습니다.</li>
          <li><b>거부권 행사:</b> 이용자는 언제든지 앱 내 [거래 → 스케줄] 화면에서 자동 매수를 일시정지·삭제할 수 있으며,
            「개인정보 보호법」 §37-2에 따라 자동화된 의사결정에 대한 설명 요구·거부권을 행사할 수 있습니다.
            거부 의사는 카카오톡 채널 <b>@mycoinbot</b> 또는 이메일로 회사에 통지할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제10조 개인정보 보호를 위한 안전성 확보 조치">
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li><b>내부관리계획 수립·시행:</b> 개인정보 처리 방침 및 내부 운영 가이드 정기 점검</li>
          <li><b>접근 권한 관리:</b> 관리자 계정 분리, 최소 권한 원칙</li>
          <li><b>접근 통제:</b> 외부 접근 IP 화이트리스트, 운영 서버 SSH 키 인증</li>
          <li><b>암호화:</b> 거래소 API Key는 AES-256-GCM (PIN 또는 디바이스 키 기반), 통신은 TLS 1.2+, 세션 토큰은 HTTPS Only 쿠키</li>
          <li><b>접속기록 보관·점검:</b> 서버 접속 로그 3개월 보관, 비정상 접근 탐지</li>
          <li><b>악성프로그램 방지:</b> 서버 보안 업데이트 자동화, 의존 패키지 취약점 모니터링</li>
          <li><b>출력·복사 통제:</b> 관리자 화면에서 회원 식별정보 마스킹</li>
          <li><b>물리적 안전 조치:</b> 데이터는 수탁업체(AWS·Supabase·Firebase)의 데이터센터 물리 보안 정책에 따라 보호됩니다</li>
          <li><b>PIN 보호:</b> 5회 연속 실패 시 10분 잠금, 분실 시 복구 불가 — 키 재등록 필요</li>
          <li><b>생체 인증:</b> WebAuthn 표준 — 지문·얼굴 데이터는 OS Secure Enclave 보관, 회사 미수집</li>
        </ul>
      </Section>

      <Section title="제11조 가입 연령 및 미성년자의 개인정보 처리">
        <p className="text-sm text-gray-700 break-keep mb-2">
          본 서비스는 국내 가상자산 거래소(빗썸·업비트·코인원·코빗·고팍스)의 API를 매개하는 특성상,
          해당 거래소가 「특정금융정보법」 및 실명확인 입출금 계좌 발급 기준에 따라 가입을 제한하는 것과 동일하게
          <b> 만 19세 이상</b>의 이용자만 회원으로 가입할 수 있습니다.
        </p>
        <ul className="text-sm text-gray-700 break-keep list-disc pl-5 space-y-1">
          <li><b>만 19세 미만:</b> 회원 가입 불가. 가입 후 만 19세 미만임이 확인되는 경우 즉시 탈퇴 처리하고 수집된 개인정보를 파기합니다.</li>
          <li><b>만 14세 미만:</b> 회사는 만 14세 미만 아동의 개인정보를 「개인정보 보호법」 §22-2에 따라 법정대리인의 동의 없이는 수집·이용하지 않으며, 동의 없이 수집된 사실이 확인될 경우 즉시 파기합니다.</li>
        </ul>
      </Section>

      <Section title="제12조 쿠키의 사용 (자동수집장치)">
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>회사는 로그인 세션 유지 목적으로 JWT 기반 인증 쿠키를 사용합니다 (HTTPS Only, HttpOnly).</li>
          <li>광고·추적 목적의 제3자 쿠키는 사용하지 않습니다.</li>
          <li>이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 거부 시 로그인이 불가능하여 사실상 모든 서비스 이용이 제한됩니다.</li>
        </ul>
      </Section>

      <Section title="제13조 가명정보의 처리">
        <p className="text-sm text-gray-700 break-keep">
          회사는 「개인정보 보호법」 §28-2에 따른 가명정보를 별도로 처리하지 않습니다.
          운영 분석에는 개인을 식별할 수 없는 익명 통계 데이터만 사용합니다.
        </p>
      </Section>

      <Section title="제14조 마케팅 활용 미사용">
        <p className="text-sm text-gray-700 break-keep">
          회사는 이용자의 개인정보를 광고·마케팅·프로파일링 목적으로 이용하거나 제3자에게 제공하지 않습니다.
          서비스 운영상 필수 안내(중요 변경, 보안 알림)는 이용자의 별도 동의 없이 발송될 수 있습니다.
        </p>
      </Section>

      <Section title="제15조 개인정보의 파기 절차 및 방법">
        <ul className="space-y-2 text-sm text-gray-700 break-keep">
          <li><b>파기 절차:</b> 보유 기간 경과 또는 처리 목적 달성 시, 내부 방침 및 관련 법령에 따라 즉시 파기합니다.</li>
          <li><b>전자적 파일:</b> 복구 불가능한 방법으로 영구 삭제합니다.</li>
          <li><b>출력물:</b> 파쇄 또는 소각합니다.</li>
          <li><b>거래소 API Key (이용자 기기 저장):</b> 회원 탈퇴 또는 앱 데이터 삭제 시 기기에서 즉시 삭제됩니다. 회사는 해당 데이터를 보유하지 않습니다.</li>
          <li><b>PWA 데이터 삭제 방법:</b> Android Chrome 기준 [설정 → 앱 → MyCoinBot → 저장공간 → 데이터 삭제], iOS Safari 기준 [설정 → Safari → 고급 → 웹 사이트 데이터 → mycoinbot 검색 → 삭제]</li>
        </ul>
      </Section>

      <Section title="제16조 이용자의 권리와 행사 방법">
        <p className="text-sm text-gray-700 break-keep mb-2">이용자는 언제든지 아래 권리를 행사할 수 있습니다.</p>
        <ul className="space-y-1 text-sm text-gray-700 break-keep list-disc pl-5">
          <li>개인정보 열람·정정·삭제 요청</li>
          <li>개인정보 처리 정지 요청</li>
          <li>회원 탈퇴를 통한 개인정보 전체 삭제 — 앱 [내 정보] → [회원 탈퇴]</li>
          <li>알림 수신 거부 — 앱 [내 정보] → [알림 설정]</li>
        </ul>
        <p className="text-sm text-gray-700 break-keep mt-2">
          권리 행사는 카카오톡 채널 <b>@mycoinbot</b> 또는 이메일을 통해 요청하실 수 있으며, 회사는 지체 없이 처리합니다.
          만 14세 미만 아동의 권리는 법정대리인이 행사할 수 있습니다.
        </p>
      </Section>

      <Section title="제17조 개인정보 보호책임자">
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
          개인정보 침해에 관한 신고·상담은 아래 기관에 문의하실 수 있습니다.
        </p>
        <ul className="text-xs text-gray-600 break-keep list-disc pl-5 mt-1 space-y-0.5">
          <li>개인정보분쟁조정위원회 (국번 없이) 1833-6972 / www.kopico.go.kr</li>
          <li>개인정보침해신고센터 (국번 없이) 118 / privacy.kisa.or.kr</li>
          <li>대검찰청 사이버수사과 (국번 없이) 1301 / spo.go.kr</li>
          <li>경찰청 사이버수사국 (국번 없이) 182 / ecrm.cyber.go.kr</li>
        </ul>
      </Section>

      <Section title="제18조 개인정보처리방침의 변경">
        <p className="text-sm text-gray-700 break-keep">
          본 방침은 법령·서비스 변경에 따라 수정될 수 있으며, 중요한 변경 시 시행 7일 전부터
          서비스 공지사항 또는 앱 알림을 통해 사전 안내합니다. 다만, 이용자 권리에 중대한 영향을 미치는
          변경의 경우 시행 30일 전부터 안내하고 별도 동의를 받습니다.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-600">브로솔루션 · MyCoinBot · 시행일 2025년 4월 1일 · 최종 수정일 2026년 5월 4일</p>
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
