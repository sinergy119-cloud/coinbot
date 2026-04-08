import { readFileSync } from 'fs'
import { join } from 'path'

// GET /api/guide → docs/SERVICE_GUIDE.md 파일 내용 반환
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'docs', 'SERVICE_GUIDE.md')
    const content = readFileSync(filePath, 'utf-8')
    return Response.json({ content })
  } catch {
    return Response.json({ content: '서비스 소개를 불러올 수 없습니다.' }, { status: 500 })
  }
}
