import { NextRequest, NextResponse } from "next/server"
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 })
    }

    const uploadDir = path.resolve(process.cwd(), 'storage', 'uploads')
    const filePath = path.join(uploadDir, filename)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Get file stats
    const stats = await fs.stat(filePath)

    // Extract original filename (remove UUID prefix)
    const originalFilename = filename.split('-').slice(1).join('-') || filename

    // Create response with file
    const fileBuffer = await fs.readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${originalFilename}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, no-cache',
      },
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}