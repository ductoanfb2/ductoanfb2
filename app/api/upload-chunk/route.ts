import { NextRequest, NextResponse } from 'next/server'
import { appendFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob
    const uploadId = formData.get('uploadId') as string
    const isOutro = formData.get('isOutro') === 'true'

    const tempDir = join(process.cwd(), 'temp', uploadId)
    if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true })

    const fileName = isOutro ? 'outro_video.tmp' : 'full_video.tmp'
    const filePath = join(tempDir, fileName)
    
    const buffer = Buffer.from(await chunk.arrayBuffer())
    await appendFile(filePath, buffer) // Tự động nối file

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Ghi chunk lỗi' }, { status: 500 })
  }
}
