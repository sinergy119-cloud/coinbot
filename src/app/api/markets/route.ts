import { NextRequest } from 'next/server'
import type { Exchange } from '@/types/database'

export interface CoinInfo { code: string; name: string }

// 한국어 코인명 매핑 (Bithumb/Upbit API에 포함되지 않는 거래소용 폴백)
const COIN_NAMES: Record<string, string> = {
  BTC: '비트코인', ETH: '이더리움', XRP: '리플', ADA: '에이다', SOL: '솔라나',
  DOT: '폴카닷', DOGE: '도지코인', USDT: '테더', USDC: 'USD코인', BNB: '바이낸스코인',
  AVAX: '아발란체', MATIC: '폴리곤', LINK: '체인링크', ATOM: '코스모스', LTC: '라이트코인',
  BCH: '비트코인캐시', UNI: '유니스왑', ALGO: '알고랜드', MANA: '디센트럴랜드',
  SAND: '더샌드박스', AXS: '엑시인피니티', SHIB: '시바이누', TRX: '트론',
  ETC: '이더리움클래식', XLM: '스텔라루멘', NEAR: '니어프로토콜', FTM: '팬텀',
  VET: '비체인', THETA: '세타토큰', FIL: '파일코인', ICP: '인터넷컴퓨터',
  AAVE: '아에베', MKR: '메이커', COMP: '컴파운드', YFI: '연파이낸스',
  SNX: '신테틱스', CRV: '커브다오', SUSHI: '스시스왑', ZRX: '제로엑스',
  BAT: '베이직어텐션토큰', ENJ: '엔진코인', CHZ: '칠리즈', HOT: '홀로체인',
  IOST: '아이오에스티', IOTA: '아이오타', QTUM: '퀀텀', ZIL: '질리카',
  KNC: '카이버네트워크', GRT: '더그래프', ICX: '아이콘', ELF: '엘프',
  WAVES: '웨이브스', ONT: '온톨로지', STEEM: '스팀', HBAR: '헤데라',
  FLOW: '플로우', APE: '에이프코인', LDO: '리도다오', ARB: '아비트럼',
  OP: '옵티미즘', SUI: '수이', APT: '앱토스', SEI: '세이네트워크',
  TIA: '셀레스티아', KAVA: '카바', INJ: '인젝티브', CTC: '크레딧코인',
  BORA: '보라', HUNT: '헌트', AERGO: '아에르고', WAXP: '왁스',
  GLM: '골렘', SNT: '스테이터스', BAL: '밸런서', GNO: '노시스',
  POWR: '파워렛저', REQ: '리퀘스트', OGN: '오리진프로토콜', AIN: '에이아이네트워크',
  PYTH: '피스네트워크', BLUR: '블러', ANKR: '앙카르', BAND: '밴드프로토콜',
  CAKE: '팬케이크스왑', ORBS: '오브스', GXA: '지엑사', LSK: '리스크',
  CRO: '크로노스', LINK2: '체인링크', EGLD: '멀티버스엑스', OSMO: '오스모시스',
  PENGU: '펭구', DOOD: '두드', MOVE: '무브먼트', KAITO: '카이토',
  BLAST: '블라스트', ETHFI: '이더파이', LPT: '라이브피어', KAIA: '카이아',
  // 코빗/코인원/고팍스 주요 코인 추가
  CROSS: '크로쓰', HNT: '헬리움', XTZ: '테조스', ROSE: '오아시스네트워크',
  WIF: '도그위프햇', ENA: '에테나', ONDO: '온도파이낸스', WLD: '월드코인',
  MINA: '미나프로토콜', PAXG: '팍소스골드', KSM: '쿠사마', WBTC: '랩드비트코인',
  DYDX: '디와이디엑스', GMT: '스테픈', RENDER: '렌더토큰', TON: '톤코인',
  GALA: '갈라', RUNE: '토르체인', BONK: '봉크', CELO: '셀로',
  ENS: '이더리움네임서비스', PEPE: '페페', STX: '스택스', IMX: '이뮤터블엑스',
  PENDLE: '펜들', RPL: '로켓풀', GMX: 'GMX', CVX: '컨벡스파이낸스',
  STORJ: '스토리지', AKT: '아카시네트워크', STRK: '스타크넷', ARK: '아크',
  JUP: '주피터', AERO: '에어로드롬', TAO: '비텐서', JTO: '지토',
  EIGEN: '아이겐레이어', RON: '로닌', SYN: '시냅스', POL: '폴리곤에코시스템',
  VIRTUAL: '버추얼프로토콜', HYPE: '하이퍼리퀴드', ONE: '하모니', XEC: '이캐시',
  GLMR: '문빔', FLR: '플레어', SGB: '송버드', BTT: '비트토렌트',
  BSV: '비트코인에스브이', STG: '스타게이트', ASTR: '아스타네트워크',
  YGG: '일드길드게임즈', AUDIO: '오디우스', NMR: '뉴머레어', UMA: 'UMA',
  FET: '페치에이아이', ZK: '지케이싱크', RAY: '레이디움', ALT: '알트레이어',
  PIXEL: '픽셀', GMT2: '스테픈', MNT: '맨틀', XPLA: '엑스플라',
  USDS: 'USD스테이블', FDUSD: '퍼스트디지털USD', WAXL: '왁슬', T: '쓰레스홀드',
  W: '웜홀', MOCA: '모카버스', GTC: '기트코인', RARE: '슈퍼레어',
  BNT: '뱅코르', ACX: '어크로스프로토콜', CFG: '센트리퓨지', POKT: '포켓네트워크',
  ILV: '일루비움', GRASS: '그래스', TAIKO: '타이코', ZRO: '레이어제로',
  ME: '매직에덴', SKY: '스카이', EDU: '오픈캠퍼스', MBX: '메타버스엑스',
  AMP: '앰프', CYBER: '사이버커넥트', LOOKS: '룩스레어', MED: '메디블록',
  BFC: '비파이낸스', MNDE: '마리나드파이낸스',
}

function withNames(codes: string[]): CoinInfo[] {
  return codes.map(code => ({ code, name: COIN_NAMES[code] ?? code }))
}

async function getCoinsWithNames(exchange: Exchange): Promise<CoinInfo[]> {
  try {
    if (exchange === 'BITHUMB') {
      const res = await fetch('https://api.bithumb.com/v1/market/all?isDetails=false')
      if (!res.ok) throw new Error(`빗썸 오류 (${res.status})`)
      const data = await res.json() as Array<{ market: string; korean_name: string }>
      return data
        .filter(m => m.market.startsWith('KRW-'))
        .map(m => ({ code: m.market.replace('KRW-', ''), name: m.korean_name || m.market.replace('KRW-', '') }))
    }

    if (exchange === 'UPBIT') {
      const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false')
      if (!res.ok) throw new Error(`업비트 오류 (${res.status})`)
      const data = await res.json() as Array<{ market: string; korean_name: string }>
      return data
        .filter(m => m.market.startsWith('KRW-'))
        .map(m => ({ code: m.market.replace('KRW-', ''), name: m.korean_name || m.market.replace('KRW-', '') }))
    }

    if (exchange === 'COINONE') {
      const { coinoneGetMarkets } = await import('@/lib/coinone')
      const codes = (await coinoneGetMarkets()).map(s => s.replace('/KRW', ''))
      return withNames(codes)
    }

    if (exchange === 'KORBIT') {
      const { korbitGetMarkets } = await import('@/lib/korbit')
      const codes = (await korbitGetMarkets()).map(s => s.replace('/KRW', ''))
      return withNames(codes)
    }

    if (exchange === 'GOPAX') {
      const { gopaxGetMarkets } = await import('@/lib/gopax')
      const codes = (await gopaxGetMarkets()).map(s => s.replace('-KRW', '').replace('-krw', ''))
      return withNames(codes)
    }
  } catch (err) {
    console.error(`[markets] ${exchange} 오류:`, err instanceof Error ? err.message : err)
  }
  return []
}

export async function GET(req: NextRequest) {
  const exchange = req.nextUrl.searchParams.get('exchange') as Exchange | null
  if (!exchange) return Response.json({ error: 'exchange 파라미터 필요' }, { status: 400 })

  const coins = await getCoinsWithNames(exchange)
  return Response.json(coins, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
