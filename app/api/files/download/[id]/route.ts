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
                sharedWithEmail: session.user.email,
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

    // Fetch file from blob storage
    const response = await fetch(file.url)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 })
    }

    let fileData = await response.arrayBuffer()
    let contentType = file.type
    let fileName = file.name

    // Decrypt if file is encrypted and key is provided
    if (file.encrypted) {
      if (!decryptionKey) {
        return NextResponse.json({ error: "Decryption key required for encrypted file" }, { status: 400 })
      }

      try {
        // Get encrypted data as string first
        const encryptedText = await response.text()
        fileData = decryptFile(encryptedText, decryptionKey)
        contentType = file.type // Restore original content type
        fileName = file.originalName || file.name
      } catch (error) {
        console.error('Decryption error:', error)
        return NextResponse.json({ error: "Invalid decryption key" }, { status: 400 })
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