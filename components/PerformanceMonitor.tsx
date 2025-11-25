"use client"

import { useEffect, useState } from 'react'

interface PerformanceMetrics {
  fcp: number | null
  lcp: number | null
  fid: number | null
  cls: number | null
  ttfb: number | null
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null
  })

  useEffect(() => {
    // Basic performance monitoring
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          setMetrics(prev => ({
            ...prev,
            ttfb: navEntry.responseStart - navEntry.requestStart
          }))
        } else if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          setMetrics(prev => ({ ...prev, fcp: entry.startTime }))
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['navigation', 'paint'] })
    } catch (e) {
      console.warn('Performance monitoring not fully supported')
    }

    // Memory usage monitoring (Chrome only)
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory
        console.log('Memory usage:', {
          used: Math.round(memInfo.usedJSHeapSize / 1048576),
          total: Math.round(memInfo.totalJSHeapSize / 1048576),
          limit: Math.round(memInfo.jsHeapSizeLimit / 1048576)
        })
      }
    }

    // Monitor memory every 30 seconds
    const memoryInterval = setInterval(monitorMemory, 30000)

    return () => {
      observer.disconnect()
      clearInterval(memoryInterval)
    }
  }, [])

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded font-mono z-50 max-w-xs">
      <div className="text-yellow-400 mb-1">Performance Metrics</div>
      {metrics.fcp && <div>FCP: {metrics.fcp.toFixed(0)}ms</div>}
      {metrics.lcp && <div>LCP: {metrics.lcp.toFixed(0)}ms</div>}
      {metrics.fid && <div>FID: {metrics.fid.toFixed(0)}ms</div>}
      {metrics.cls && <div>CLS: {metrics.cls.toFixed(3)}</div>}
      {metrics.ttfb && <div>TTFB: {metrics.ttfb.toFixed(0)}ms</div>}
    </div>
  )
}