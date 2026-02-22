import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const outroVideoFile = formData.get('outroVideo') as File
    const resolution = formData.get('resolution') as string
    const mirrored = formData.get('mirrored') === 'true'

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    // Tạo thư mục temp nếu chưa có
    const tempDir = join(process.cwd(), 'temp')
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    const timestamp = Date.now()
    const inputFileName = `input_${timestamp}.${videoFile.name.split('.').pop()}`
    const outputFileName = `output_${timestamp}.mp4`
    
    const inputPath = join(tempDir, inputFileName)
    const outputPath = join(tempDir, outputFileName)

    const arrayBuffer = await videoFile.arrayBuffer()
    await writeFile(inputPath, Buffer.from(arrayBuffer))

    // Lệnh FFmpeg
    const resolutions = { '720p': '720x1280', '1080p': '1080x1920', '4K': '2160x3840' }
    const targetResolution = resolutions[resolution as keyof typeof resolutions] || resolutions['1080p']

    let ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k -s ${targetResolution}`

    if (mirrored) ffmpegCommand += ' -vf "hflip"'

    if (outroVideoFile) {
      const outroFileName = `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`
      const outroPath = join(tempDir, outroFileName)
      await writeFile(outroPath, Buffer.from(await outroVideoFile.arrayBuffer()))

      ffmpegCommand = mirrored
        ? `ffmpeg -i "${inputPath}" -i "${outroPath}" -filter_complex "[0:v]hflip,scale=${targetResolution},setsar=1,setdar=9/16[v0];[1:v]scale=${targetResolution},setsar=1,setdar=9/16[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k`
        : `ffmpeg -i "${inputPath}" -i "${outroPath}" -filter_complex "[0:v]scale=${targetResolution},setsar=1,setdar=9/16[v0];[1:v]scale=${targetResolution},setsar=1,setdar=9/16[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k`
    }

    ffmpegCommand += ` "${outputPath}"`
    console.log('Executing FFmpeg command:', ffmpegCommand)
    await execAsync(ffmpegCommand)

    // Đọc file output
    const outputBuffer = await import('fs').then(fs => fs.promises.readFile(outputPath))

    // Cleanup temp files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
    if (outroVideoFile) {
      const outroPath = join(tempDir, `outro_${timestamp}.${outroVideoFile.name.split('.').pop()}`)
      await unlink(outroPath).catch(() => {})
    }

    // Trả về video đã xử lý như trước
    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="processed_${videoFile.name}"`,
      },
    })

  } catch (error) {
    console.error('Error processing video:', error)
    return NextResponse.json(
      { error: 'Failed to process video', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
