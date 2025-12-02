import Pusher from 'pusher'

if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
  throw new Error('Missing Pusher environment variables')
}

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
})

// Server-side trigger function
export const triggerPusherEvent = async (channel: string, event: string, data: any) => {
  try {
    await pusher.trigger(channel, event, data)
    console.log(`Pusher event triggered: ${channel}:${event}`)
  } catch (error) {
    console.error('Pusher trigger error:', error)
  }
}