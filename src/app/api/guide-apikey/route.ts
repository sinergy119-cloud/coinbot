import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const content = readFileSync(join(process.cwd(), 'docs', 'API_KEY_GUIDE.md'), 'utf-8')
    return Response.json({ content })
  } catch {
    return Response.json({ content: '가이드를 불러올 수 없습니다.' }, { status: 500 })
  }
}
