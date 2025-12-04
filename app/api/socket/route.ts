import { NextRequest } from 'next/server'
import { initSocket, NextApiResponseServerIo } from '@/lib/socket'

export async function GET(req: NextRequest) {
  // This endpoint initializes the socket server
  // The actual socket handling is done by the socket.io library
  return new Response('Socket endpoint', { status: 200 })
}