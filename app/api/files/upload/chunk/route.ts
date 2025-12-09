import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const CHUNK_SIZE = 1024 * 1024 // 1MB chunks
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'chunks')

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureUploadDir()

    const formData = await request.formData()
    const fileId = formData.get('fileId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const fileName = formData.get('fileName') as string
    const fileSize = parseInt(formData.get('fileSize') as string)
    const chunk = formData.get('chunk') as File

    if (!fileId || !chunk || chunkIndex === undefined || !totalChunks || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Validate chunk size
    if (chunk.size > CHUNK_SIZE) {
      return NextResponse.json({ error: 'Chunk too large' }, { status: 400 })
    }

    // Create chunk directory for this file
    const fileChunkDir = path.join(UPLOAD_DIR, fileId)
    if (!existsSync(fileChunkDir)) {
      await mkdir(fileChunkDir, { recursive: true })
    }

    // Save chunk
    const chunkPath = path.join(fileChunkDir, `chunk_${chunkIndex}`)
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    await writeFile(chunkPath, chunkBuffer)

    // Update progress metadata
    const metadataPath = path.join(fileChunkDir, 'metadata.json')
    let metadata = { uploadedChunks: [] as number[], totalChunks, fileName, fileSize }

    if (existsSync(metadataPath)) {
      const existingMetadata = JSON.parse(await readFile(metadataPath, 'utf-8'))
      metadata = { ...existingMetadata }
    }

    if (!metadata.uploadedChunks.includes(chunkIndex)) {
      metadata.uploadedChunks.push(chunkIndex)
      metadata.uploadedChunks.sort((a, b) => a - b)
    }

    await writeFile(metadataPath, JSON.stringify(metadata))

    // Check if upload is complete
    const isComplete = metadata.uploadedChunks.length === totalChunks

    if (isComplete) {
      // Assemble the complete file
      const completeFilePath = path.join(UPLOAD_DIR, `${fileId}_complete`)
      const writeStream = require('fs').createWriteStream(completeFilePath)

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(fileChunkDir, `chunk_${i}`)
        const chunkData = await readFile(chunkPath)
        writeStream.write(chunkData)
      }

      writeStream.end()

      // Wait for file to be written
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      return NextResponse.json({
        success: true,
        complete: true,
        fileId,
        message: 'Upload completed successfully'
      })
    }

    return NextResponse.json({
      success: true,
      complete: false,
      uploadedChunks: metadata.uploadedChunks.length,
      totalChunks,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`
    })

  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    const fileChunkDir = path.join(UPLOAD_DIR, fileId)
    const metadataPath = path.join(fileChunkDir, 'metadata.json')

    if (!existsSync(metadataPath)) {
      return NextResponse.json({ uploadedChunks: [], totalChunks: 0 })
    }

    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'))

    return NextResponse.json({
      uploadedChunks: metadata.uploadedChunks || [],
      totalChunks: metadata.totalChunks || 0,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize
    })

  } catch (error) {
    console.error('Chunk status error:', error)
    return NextResponse.json({ error: 'Failed to get upload status' }, { status: 500 })
  }
}