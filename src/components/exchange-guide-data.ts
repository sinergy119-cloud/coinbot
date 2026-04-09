// 거래소별 API Key 발급 인터랙티브 가이드 데이터

export interface GuideStep {
  title: string
  action: string
  hint: string
  mockup: 'login' | 'menu' | 'permissions' | 'ip' | 'result'
  // 권한 체크박스 데이터 (permissions 단계)
  permissions?: { label: string; checked: boolean; danger?: boolean }[]
  // 키 이름 (result 단계)
  keyNames?: string[]
}

export interface ExchangeGuideData {
  name: string
  color: string
  emoji: string
  url: string
  steps: GuideStep[]
}

export const EXCHANGE_GUIDES: Record<string, ExchangeGuideData> = {
  BITHUMB: {
    name: '빗썸',
    color: '#E06B00',
    emoji: '🟠',
    url: 'bithumb.com',
    steps: [
      {
        title: '거래소 로그인',
        action: 'bithumb.com 접속 후 로그인',
        hint: 'PC 웹에서만 API Key 발급이 가능합니다. 모바일 앱에서는 불가합니다.',
        mockup: 'login',
      },
      {
        title: 'API 관리 메뉴 이동',
        action: '우측 상단 이름 클릭 → 계정관리 → 좌측 API 관리',
        hint: '주소창에 직접 입력해도 됩니다: bithumb.com/react/api-support/management-api',
        mockup: 'menu',
      },
      {
        title: '권한 설정',
        action: 'API 2.0 탭 확인 → 권한 항목 체크',
        hint: '출금하기는 절대 체크하지 마세요! 체크하면 API Key 유출 시 자산이 출금될 수 있습니다.',
        mockup: 'permissions',
        permissions: [
          { label: '자산조회', checked: true },
          { label: '주문조회', checked: true },
          { label: '주문하기', checked: true },
          { label: '출금조회', checked: true },
          { label: '입금조회', checked: true },
          { label: '출금하기', checked: false, danger: true },
          { label: '입금하기', checked: false, danger: true },
        ],
      },
      {
        title: 'IP 주소 등록',
        action: '허용 IP에 43.203.100.239 입력 → 보안비밀번호 입력',
        hint: 'IP 주소는 MyCoinBot 서버 주소입니다. 이 IP만 API를 사용할 수 있도록 제한합니다.',
        mockup: 'ip',
      },
      {
        title: '발급 완료',
        action: 'Connect Key + Secret Key 복사 후 안전한 곳에 보관',
        hint: '⚠ Secret Key는 이 화면에서만 확인 가능합니다! 창을 닫으면 다시 볼 수 없습니다.',
        mockup: 'result',
        keyNames: ['Connect Key (= API Key)', 'Secret Key'],
      },
    ],
  },
  UPBIT: {
    name: '업비트',
    color: '#0D2562',
    emoji: '🔵',
    url: 'upbit.com',
    steps: [
      {
        title: '거래소 로그인',
        action: 'upbit.com 접속 후 카카오 계정 로그인',
        hint: '2채널 인증(카카오톡)이 완료된 상태여야 합니다. 마이페이지에서 확인하세요.',
        mockup: 'login',
      },
      {
        title: '마이페이지 이동',
        action: '우측 상단 My 버튼 → 팝업 → 마이페이지 클릭',
        hint: '마이페이지 팝업에서 진입합니다. 좌측 메뉴가 아닌 우측 상단 버튼입니다.',
        mockup: 'menu',
      },
      {
        title: '권한·IP 설정',
        action: 'Open API 관리 → 권한 체크 → IP 입력 → reCAPTCHA 체크',
        hint: '출금하기/입금하기는 절대 체크하지 마세요! "로봇이 아닙니다" 체크도 필수입니다.',
        mockup: 'permissions',
        permissions: [
          { label: '자산조회', checked: true },
          { label: '주문조회', checked: true },
          { label: '주문하기', checked: true },
          { label: '출금조회', checked: true },
          { label: '입금조회', checked: true },
          { label: '출금하기', checked: false, danger: true },
          { label: '입금하기', checked: false, danger: true },
        ],
      },
      {
        title: 'IP 주소 등록',
        action: 'IP 주소 입력란에 43.203.100.239 입력',
        hint: 'IP는 최대 10개까지 등록 가능합니다. 공인 IP만 등록할 수 있습니다.',
        mockup: 'ip',
      },
      {
        title: '발급 완료',
        action: 'Access Key + Secret Key 복사 후 안전한 곳에 보관',
        hint: '⚠ 확인 버튼을 누르면 Secret Key를 다시 볼 수 없습니다! API Key 유효기간은 1년입니다.',
        mockup: 'result',
        keyNames: ['Access Key', 'Secret Key'],
      },
    ],
  },
  COINONE: {
    name: '코인원',
    color: '#0046FF',
    emoji: '🟢',
    url: 'coinone.co.kr',
    steps: [
      {
        title: '거래소 로그인',
        action: 'coinone.co.kr 접속 후 로그인',
        hint: 'PC 웹에서만 API Key 발급이 가능합니다.',
        mockup: 'login',
      },
      {
        title: 'Open API 진입',
        action: '우측 상단 프로필 아바타 → 팝업 → Open API 클릭',
        hint: '팝업 메뉴에서 "Open API"를 선택합니다.',
        mockup: 'menu',
      },
      {
        title: '권한 설정',
        action: '새로운 키 발급 → API 이름 입력 → 권한 체크',
        hint: '출금 권한은 절대 체크하지 마세요! 권한은 생성 후 변경 불가이므로 신중하게 선택하세요.',
        mockup: 'permissions',
        permissions: [
          { label: '잔고 조회', checked: true },
          { label: '고객 정보', checked: true },
          { label: '입출금 조회', checked: true },
          { label: '주문 조회', checked: true },
          { label: '주문 권한', checked: true },
          { label: '출금 권한', checked: false, danger: true },
        ],
      },
      {
        title: 'IP 주소 등록',
        action: 'IP 지정 토글 ON → 43.203.100.239 입력',
        hint: 'IP 지정 토글을 반드시 ON으로 설정하세요. 미설정 시 모든 IP에서 접근 가능해져 위험합니다.',
        mockup: 'ip',
      },
      {
        title: '발급 완료',
        action: 'Access Token + Secret Key 복사 후 안전한 곳에 보관',
        hint: '⚠ 팝업을 닫으면 Secret Key를 다시 확인할 수 없습니다!',
        mockup: 'result',
        keyNames: ['Access Token (= API Key)', 'Secret Key'],
      },
    ],
  },
  KORBIT: {
    name: '코빗',
    color: '#111111',
    emoji: '🟣',
    url: 'korbit.co.kr',
    steps: [
      {
        title: '거래소 로그인',
        action: 'korbit.co.kr 접속 후 로그인',
        hint: 'PC 웹에서만 API Key 발급이 가능합니다.',
        mockup: 'login',
      },
      {
        title: 'Open API 진입',
        action: '상단 서비스 → 드롭다운 → Open API 클릭',
        hint: '개발자센터(developers.korbit.co.kr)가 별도 사이트로 열립니다.',
        mockup: 'menu',
      },
      {
        title: '권한 설정',
        action: 'API 이름 입력 → HMAC-SHA256 선택 → 권한 체크',
        hint: '입금 신청/출금 신청은 절대 체크하지 마세요! HMAC-SHA256이 일반 사용자용입니다.',
        mockup: 'permissions',
        permissions: [
          { label: '자산 조회', checked: true },
          { label: '주문 조회', checked: true },
          { label: '입금 조회', checked: true },
          { label: '출금 조회', checked: true },
          { label: '주문 신청', checked: true },
          { label: '입금 신청', checked: false, danger: true },
          { label: '출금 신청', checked: false, danger: true },
        ],
      },
      {
        title: 'IP 주소 등록',
        action: 'IP 허용 목록에 43.203.100.239 입력',
        hint: 'IP 주소는 MyCoinBot 서버 주소입니다.',
        mockup: 'ip',
      },
      {
        title: '발급 완료',
        action: 'API Key + Secret Key 복사 후 안전한 곳에 보관',
        hint: '⚠ 확인 후 Secret Key를 다시 볼 수 없습니다! 유효기간 1년, 만료 후 3개월 지나면 삭제됩니다.',
        mockup: 'result',
        keyNames: ['API Key', 'Secret Key'],
      },
    ],
  },
  GOPAX: {
    name: '고팍스',
    color: '#F5A623',
    emoji: '🟡',
    url: 'gopax.co.kr',
    steps: [
      {
        title: '거래소 로그인',
        action: 'gopax.co.kr 접속 후 로그인',
        hint: 'PC 웹에서만 API Key 발급이 가능합니다.',
        mockup: 'login',
      },
      {
        title: '계정관리 이동',
        action: '우측 상단 계정관리 버튼 클릭 → 페이지 하단 스크롤',
        hint: 'API 키 메뉴는 계정관리 페이지 최하단 아코디언에 있습니다. (보안정보 → 알림 → API 키 순서)',
        mockup: 'menu',
      },
      {
        title: '권한 설정',
        action: 'API 키 아코디언 → 새 API 키 등록 → 거래소 주문 체크',
        hint: '가상자산 출금은 절대 체크하지 마세요! 고팍스는 권한이 2개뿐이라 단순합니다.',
        mockup: 'permissions',
        permissions: [
          { label: '거래소 주문', checked: true },
          { label: '가상자산 출금', checked: false, danger: true },
        ],
      },
      {
        title: 'IP 주소 등록',
        action: 'IP 입력란에 43.203.100.239 입력',
        hint: 'IP 등록은 가상자산 출금 제한용이지만, 보안을 위해 등록을 권장합니다.',
        mockup: 'ip',
      },
      {
        title: '발급 완료',
        action: 'API Key + Secret Key 복사 후 안전한 곳에 보관',
        hint: '⚠ 팝업을 닫으면 Secret Key를 다시 확인할 수 없습니다! API Key 유효기간은 1년입니다.',
        mockup: 'result',
        keyNames: ['API Key', 'Secret Key'],
      },
    ],
  },
}
