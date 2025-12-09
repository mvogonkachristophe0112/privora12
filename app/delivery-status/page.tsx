"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import DeliveryStatusDashboard from "@/components/DeliveryStatusDashboard"
import { Loading } from "@/components/Loading"

export default function DeliveryStatusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loading text="Loading..." />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <DeliveryStatusDashboard />
        </div>
      </div>
    </div>
  )
}