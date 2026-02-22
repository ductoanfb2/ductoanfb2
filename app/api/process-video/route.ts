import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, rm, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
export const runtime = 'nodejs'
export const maxDuration = 300 

async function waitFile(path: string) {
  for (let i = 0; i < 10; i++) {
    if (existsSync(path) && (await stat(path)).size > 0) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId, fileName, resolution, mirrored, hasOutro } = body;
    
    const tempDir = join(process.cwd(), 'temp', uploadId)
    const inputPath = join(tempDir, 'full_video.tmp')
    const outputPath = join(tempDir, `out_${Date.now()}.mp4`)
    const outroPath = join(tempDir, 'outro_video.tmp')

    // 1. Kiểm tra file gốc đã upload xong chưa
    if (!(await waitFile(inputPath))) {
      return NextResponse.json({ error: 'Không tìm thấy file video đã upload' }, { status: 404 })
    }

    // 2. Cấu hình độ phân giải
    const resolutions = { '720p': '720:1280', '1080p': '1080:1920', '4K': '2160:3840' }
    const targetRes = resolutions[resolution as keyof typeof resolutions] || resolutions['1080p']

    let ffmpegCommand = ""

    // 3. Xây dựng lệnh FFmpeg dựa trên việc có Outro hay không
    if (hasOutro && existsSync(outroPath)) {
      // TRƯỜNG HỢP CÓ OUTRO: Ghép video
      const flipFilter = mirrored ? 'hflip,' : ''
      ffmpegCommand = `ffmpeg -y -i "${inputPath}" -i "${outroPath}" -filter_complex "[0:v]${flipFilter}scale=${targetRes},setsar=1,setdar=9/16[v0];[1:v]scale=${targetRes},setsar=1,setdar=9/16[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k "${outputPath}"`
    } else {
      // TRƯỜNG HỢP KHÔNG OUTRO: Chỉ scale/flip
      const vf = mirrored 
        ? `hflip,scale=${targetRes},setsar=1,setdar=9/16` 
        : `scale=${targetRes},setsar=1,setdar=9/16`
      ffmpegCommand = `ffmpeg -y -i "${inputPath}" -vf "${vf}" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k "${outputPath}"`
    }

    console.log('Executing FFmpeg command:', ffmpegCommand)
    await execAsync(ffmpegCommand)
    
    if (!existsSync(outputPath)) {
        throw new Error("FFmpeg không tạo được file output.")
    }

    const buffer = await readFile(outputPath)
    
    // 4. Dọn dẹp thư mục tạm
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})

    return new Response(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="edited_${fileName}"`,
      },
    })

  } catch (error) {
    console.error("Render Error:", error)
    return NextResponse.json({ 
        error: 'Render lỗi', 
        details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
