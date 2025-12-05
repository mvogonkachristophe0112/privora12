import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { decryptFile } from "@/lib/crypto"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const decryptionKey = searchParams.get('key')

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const fileId = resolvedParams.id

    // Check if user owns the file or has access via sharing
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [
          { userId: session.user.id }, // Owner
          {
            shares: {
              some: {
                sharedWithEmail: session.user.email.toLowerCase(),
                revoked: false,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } }
                ]
              }
            }
          }
        ]
      }
    })

    if (!file) {
      return NextResponse.json({ error: "File not found or access denied" }, { status: 404 })
    }

    // Fetch file from blob storage with timeout
    console.log('Fetching file from storage:', file.url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

    let response: Response
    try {
      response = await fetch(file.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Privora12-Download/1.0'
        }
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error('File fetch error:', fetchError)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({ error: "Download request timed out. File may be too large or storage is slow." }, { status: 408 })
      }

      return NextResponse.json({
        error: "Failed to fetch file from storage",
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      }, { status: 500 })
    }

    clearTimeout(timeoutId)

    console.log('Storage response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Storage response error:', response.status, errorText)
      return NextResponse.json({
        error: `Failed to fetch file from storage: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: 502 })
    }

    let fileData: ArrayBuffer
    let contentType = file.type
    let fileName = file.name

    // Handle encrypted vs non-encrypted files differently
    if (file.encrypted) {
      if (!decryptionKey) {
        return NextResponse.json({ error: "Decryption key required for encrypted file" }, { status: 400 })
      }

      try {
        // For encrypted files, get as text first
        const encryptedText = await response.text()
        fileData = decryptFile(encryptedText, decryptionKey)
        contentType = file.type // Restore original content type
        fileName = file.originalName || file.name
      } catch (error) {
        console.error('Decryption error:', error)
        return NextResponse.json({
          error: "Failed to decrypt file. Please check your decryption key.",
          details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
        }, { status: 400 })
      }
    } else {
      // For non-encrypted files, get as array buffer
      try {
        fileData = await response.arrayBuffer()
      } catch (error) {
        console.error('File fetch error:', error)
        return NextResponse.json({ error: "Failed to read file data" }, { status: 500 })
      }
    }

    // Return file with appropriate headers
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileData.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('GET /api/files/download/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}