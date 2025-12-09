import { DownloadItem } from '@/components/DownloadManager'

export interface DownloadProgressCallback {
  (id: string, progress: number, speed: number, eta: number, downloadedBytes: number): void
}

export interface DownloadCompleteCallback {
  (id: string): void
}

export interface DownloadErrorCallback {
  (id: string, error: string): void
}

export class DownloadQueue {
  private activeDownloads = new Map<string, AbortController>()
  private maxConcurrent: number
  private onProgress?: DownloadProgressCallback
  private onComplete?: DownloadCompleteCallback
  private onError?: DownloadErrorCallback

  constructor(
    maxConcurrent = 3,
    onProgress?: DownloadProgressCallback,
    onComplete?: DownloadCompleteCallback,
    onError?: DownloadErrorCallback
  ) {
    this.maxConcurrent = maxConcurrent
    this.onProgress = onProgress
    this.onComplete = onComplete
    this.onError = onError
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = max
  }

  async startDownload(item: DownloadItem): Promise<void> {
    if (this.activeDownloads.size >= this.maxConcurrent) {
      throw new Error('Maximum concurrent downloads reached')
    }

    if (this.activeDownloads.has(item.id)) {
      throw new Error('Download already in progress')
    }

    const controller = new AbortController()
    this.activeDownloads.set(item.id, controller)

    try {
      await this.performDownload(item, controller.signal)
    } catch (error) {
      this.activeDownloads.delete(item.id)
      throw error
    }
  }

  pauseDownload(id: string): void {
    const controller = this.activeDownloads.get(id)
    if (controller) {
      controller.abort()
      this.activeDownloads.delete(id)
    }
  }

  cancelDownload(id: string): void {
    const controller = this.activeDownloads.get(id)
    if (controller) {
      controller.abort()
      this.activeDownloads.delete(id)
    }
  }

  getActiveDownloadCount(): number {
    return this.activeDownloads.size
  }

  private async performDownload(item: DownloadItem, signal: AbortSignal): Promise<void> {
    const startTime = Date.now()
    let downloadedBytes = item.downloadedBytes || 0
    let lastProgressUpdate = Date.now()
    let speedSamples: number[] = []

    try {
      // Check if we can resume
      const supportsRange = await this.checkRangeSupport(item)
      const startByte = supportsRange && downloadedBytes > 0 ? downloadedBytes : 0

      const url = `/api/files/download/${item.fileId}${item.decryptionKey ? `?key=${encodeURIComponent(item.decryptionKey)}` : ''}`

      const headers: Record<string, string> = {
        'User-Agent': 'Privora12-DownloadManager/1.0'
      }

      // Add Range header for resume
      if (supportsRange && startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`
      }

      const response = await fetch(url, {
        signal,
        headers
      })

      if (!response.ok) {
        let errorMessage = 'Download failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Download failed: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const contentLength = response.headers.get('Content-Length')
      const totalBytes = contentLength ? parseInt(contentLength) + startByte : item.size

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        if (signal.aborted) {
          throw new Error('Download cancelled')
        }

        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        downloadedBytes += value.length

        // Calculate progress and speed
        const progress = (downloadedBytes / totalBytes) * 100
        const now = Date.now()
        const timeElapsed = (now - startTime) / 1000 // seconds

        if (timeElapsed > 0) {
          const currentSpeed = downloadedBytes / timeElapsed
          speedSamples.push(currentSpeed)

          // Keep only last 10 samples for average
          if (speedSamples.length > 10) {
            speedSamples.shift()
          }

          const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
          const remainingBytes = totalBytes - downloadedBytes
          const eta = avgSpeed > 0 ? remainingBytes / avgSpeed : 0

          // Throttle progress updates to every 100ms
          if (now - lastProgressUpdate > 100) {
            this.onProgress?.(item.id, progress, avgSpeed, eta, downloadedBytes)
            lastProgressUpdate = now
          }
        }
      }

      // Combine all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      // Create blob and trigger download
      const blob = new Blob([result])
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = item.originalName || item.name
      a.style.display = 'none'
      a.rel = 'noopener noreferrer'

      document.body.appendChild(a)
      a.click()

      // Clean up
      setTimeout(() => {
        try {
          document.body.removeChild(a)
          window.URL.revokeObjectURL(downloadUrl)
        } catch (cleanupError) {
          console.warn('Cleanup warning (non-critical):', cleanupError)
        }
      }, 200)

      this.activeDownloads.delete(item.id)
      this.onComplete?.(item.id)

    } catch (error) {
      this.activeDownloads.delete(item.id)

      if (signal.aborted) {
        // Don't call error callback for cancelled downloads
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Download failed'
      this.onError?.(item.id, errorMessage)
    }
  }

  private async checkRangeSupport(item: DownloadItem): Promise<boolean> {
    try {
      const url = `/api/files/download/${item.fileId}${item.decryptionKey ? `?key=${encodeURIComponent(item.decryptionKey)}` : ''}`

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Privora12-DownloadManager/1.0'
        }
      })

      const acceptRanges = response.headers.get('Accept-Ranges')
      return acceptRanges === 'bytes'
    } catch {
      return false
    }
  }

  // Utility function to format bytes
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Utility function to format speed
  static formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`
  }

  // Utility function to format ETA
  static formatETA(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }
}

// Queue manager that coordinates multiple downloads
export class DownloadQueueManager {
  private queue: DownloadQueue
  private pendingItems: DownloadItem[] = []
  private processing = false

  constructor(maxConcurrent = 3) {
    this.queue = new DownloadQueue(maxConcurrent)
  }

  setMaxConcurrent(max: number) {
    this.queue.setMaxConcurrent(max)
  }

  addDownload(
    item: DownloadItem,
    onProgress?: DownloadProgressCallback,
    onComplete?: DownloadCompleteCallback,
    onError?: DownloadErrorCallback
  ) {
    // Set up callbacks
    this.queue = new DownloadQueue(
      this.queue['maxConcurrent'],
      onProgress,
      onComplete,
      onError
    )

    this.pendingItems.push(item)
    this.processQueue()
  }

  pauseDownload(id: string) {
    this.queue.pauseDownload(id)
    // Remove from pending if it's there
    this.pendingItems = this.pendingItems.filter(item => item.id !== id)
  }

  cancelDownload(id: string) {
    this.queue.cancelDownload(id)
    // Remove from pending if it's there
    this.pendingItems = this.pendingItems.filter(item => item.id !== id)
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.pendingItems.length > 0) {
      const item = this.pendingItems.shift()
      if (!item) continue

      try {
        await this.queue.startDownload(item)
      } catch (error) {
        console.error('Failed to start download:', error)
        // Could add retry logic here
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.processing = false
  }

  getActiveCount(): number {
    return this.queue.getActiveDownloadCount()
  }
}