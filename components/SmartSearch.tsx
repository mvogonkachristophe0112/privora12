"use client"

import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { smartSearch, FileMetadata } from '@/lib/ai'

interface SmartSearchProps {
  files: FileMetadata[]
  onResults: (results: FileMetadata[]) => void
  placeholder?: string
}

export function SmartSearch({ files, onResults, placeholder }: SmartSearchProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (query.length === 0) {
      onResults(files)
      setSuggestions([])
      return
    }

    if (query.length < 2) {
      setSuggestions([])
      return
    }

    performSearch(query)
  }, [query, files])

  const performSearch = async (searchQuery: string) => {
    setIsSearching(true)

    try {
      const results = await smartSearch(searchQuery, files)
      onResults(results)

      // Generate suggestions based on common tags and types
      const allTags = files.flatMap(f => f.tags || [])
      const uniqueTags = [...new Set(allTags)]
      const relevantSuggestions = uniqueTags
        .filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5)

      setSuggestions(relevantSuggestions)
    } catch (error) {
      console.error('Search failed:', error)
      onResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setSuggestions([])
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || t('common.search') || 'Search files...'}
          className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Search Suggestions */}
      {suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggestions:</div>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Tips */}
      {query.length > 0 && suggestions.length === 0 && !isSearching && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="p-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium mb-1">Search Tips:</div>
            <ul className="text-xs space-y-1">
              <li>• Search by filename, content, or tags</li>
              <li>• Try: "image", "document", "contract"</li>
              <li>• Use multiple words for better results</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}