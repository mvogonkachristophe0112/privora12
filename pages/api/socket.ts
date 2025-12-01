import { NextApiRequest } from 'next'
import { initSocket, NextApiResponseServerIo } from '@/lib/socket'

export default function handler(req: NextApiRequest, res: NextApiResponseServerIo) {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.io server...')
    const io = initSocket(res.socket.server)
    res.socket.server.io = io
  }

  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  },
}