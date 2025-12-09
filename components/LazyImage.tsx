"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Loading } from './Loading'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
  threshold?: number
  rootMargin?: string
  fallbackSrc?: string
}

export default function LazyImage({
  src,
  alt,
  className = "",
  placeholder,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  fallbackSrc
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const element = imgRef.current
    if (!element) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observerRef.current?.unobserve(element)
          }
        })
      },
      {
        threshold,
        rootMargin
      }
    )

    observerRef.current.observe(element)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [threshold, rootMargin])

  const handleLoad = () => {
    setIsLoaded(true)
    setIsLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)

    // Try fallback image if provided
    if (fallbackSrc && !hasError) {
      const img = imgRef.current
      if (img) {
        img.src = fallbackSrc
        setHasError(false)
        setIsLoading(true)
        return
      }
    }

    onError?.()
  }

  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      setIsLoading(true)
    }
  }, [isInView, isLoaded, hasError])

  return (
    <div className={`relative ${className}`}>
      {/* Placeholder/Loading state */}
      {(!isLoaded || isLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
          {placeholder ? (
            <img
              src={placeholder}
              alt=""
              className="w-full h-full object-cover rounded blur-sm"
            />
          ) : (
            <Loading size="sm" />
          )}
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {/* Error state */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-2xl mb-2">🖼️</div>
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for lazy loading any content
export function useLazyLoad(
  threshold: number = 0.1,
  rootMargin: string = '50px'
) {
  const [isInView, setIsInView] = useState(false)
  const [hasBeenViewed, setHasBeenViewed] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            setHasBeenViewed(true)
          } else {
            setIsInView(false)
          }
        })
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return { ref, isInView, hasBeenViewed }
}

// Progressive image loading with blur placeholder
interface ProgressiveImageProps extends Omit<LazyImageProps, 'placeholder'> {
  blurDataURL?: string
  quality?: number
}

export function ProgressiveImage({
  src,
  alt,
  className = "",
  blurDataURL,
  quality = 75,
  ...props
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const { ref, isInView } = useLazyLoad()

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      {isInView && (
        <LazyImage
          src={src}
          alt={alt}
          className={className}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      )}
    </div>
  )
}