// AI-powered features for Privora12

export interface FileMetadata {
  id: string
  name: string
  type: string
  size: number
  tags: string[]
  description?: string
  extractedText?: string
}

// Smart file tagging based on content and metadata
export async function generateFileTags(file: FileMetadata): Promise<string[]> {
  const tags: string[] = []

  // Basic tags from file type
  const typeTags = getTypeTags(file.type)
  tags.push(...typeTags)

  // Size-based tags
  if (file.size < 1024 * 1024) { // < 1MB
    tags.push('small-file')
  } else if (file.size < 500 * 1024 * 1024) { // < 500MB
    tags.push('medium-file')
  } else {
    tags.push('large-file')
  }

  // Content-based tags (simplified - in real implementation, use AI/ML)
  if (file.extractedText) {
    const contentTags = analyzeContent(file.extractedText)
    tags.push(...contentTags)
  }

  // Name-based tags
  const nameTags = analyzeFilename(file.name)
  tags.push(...nameTags)

  return [...new Set(tags)] // Remove duplicates
}

function getTypeTags(mimeType: string): string[] {
  const tags: string[] = []

  if (mimeType.startsWith('image/')) {
    tags.push('image', 'visual')
  } else if (mimeType.startsWith('video/')) {
    tags.push('video', 'media')
  } else if (mimeType.startsWith('audio/')) {
    tags.push('audio', 'media')
  } else if (mimeType.includes('pdf')) {
    tags.push('document', 'pdf')
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    tags.push('document', 'word')
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    tags.push('spreadsheet', 'data')
  } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    tags.push('presentation', 'slides')
  } else if (mimeType.startsWith('text/')) {
    tags.push('text', 'code')
  }

  return tags
}

function analyzeContent(text: string): string[] {
  const tags: string[] = []
  const lowerText = text.toLowerCase()

  // Business keywords
  if (lowerText.includes('meeting') || lowerText.includes('agenda')) {
    tags.push('meeting', 'business')
  }

  if (lowerText.includes('contract') || lowerText.includes('agreement')) {
    tags.push('contract', 'legal')
  }

  if (lowerText.includes('invoice') || lowerText.includes('payment')) {
    tags.push('finance', 'invoice')
  }

  // Technical keywords
  if (lowerText.includes('code') || lowerText.includes('function') || lowerText.includes('class')) {
    tags.push('code', 'development')
  }

  if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux')) {
    tags.push('design', 'ui-ux')
  }

  // Personal keywords
  if (lowerText.includes('vacation') || lowerText.includes('holiday')) {
    tags.push('vacation', 'personal')
  }

  return tags
}

function analyzeFilename(filename: string): string[] {
  const tags: string[] = []
  const lowerName = filename.toLowerCase()

  // Date patterns
  if (/\d{4}-\d{2}-\d{2}/.test(lowerName) || /\d{2}-\d{2}-\d{4}/.test(lowerName)) {
    tags.push('dated')
  }

  // Project patterns
  if (lowerName.includes('project') || lowerName.includes('proj-')) {
    tags.push('project')
  }

  // Version patterns
  if (lowerName.includes('v1') || lowerName.includes('v2') || lowerName.includes('final')) {
    tags.push('versioned')
  }

  return tags
}

// Smart search with AI-powered relevance
export async function smartSearch(query: string, files: FileMetadata[]): Promise<FileMetadata[]> {
  const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 0)

  const scoredFiles = files.map(file => {
    let score = 0
    const fileName = file.name.toLowerCase()
    const fileTags = file.tags?.join(' ').toLowerCase() || ''
    const fileDescription = file.description?.toLowerCase() || ''
    const fileText = file.extractedText?.toLowerCase() || ''

    queryTerms.forEach(term => {
      // Exact filename match gets highest score
      if (fileName.includes(term)) {
        score += 10
      }

      // Tag matches get high score
      if (fileTags.includes(term)) {
        score += 8
      }

      // Description matches get medium score
      if (fileDescription.includes(term)) {
        score += 6
      }

      // Content matches get lower score
      if (fileText.includes(term)) {
        score += 4
      }

      // Partial matches get lower scores
      if (fileName.includes(term.substring(0, 3))) {
        score += 2
      }
    })

    // File type relevance
    if (queryTerms.some(term => term.includes('image') && file.type.startsWith('image/'))) {
      score += 5
    }

    if (queryTerms.some(term => term.includes('document') && file.type.includes('pdf'))) {
      score += 5
    }

    return { file, score }
  })

  // Sort by score and return top results
  return scoredFiles
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.file)
}

// File recommendations based on user behavior
export async function getFileRecommendations(userId: string, recentFiles: FileMetadata[]): Promise<FileMetadata[]> {
  // Simple recommendation algorithm based on file types and tags
  const userPreferences = analyzeUserPreferences(recentFiles)

  // In a real implementation, this would use machine learning
  // For now, return files similar to recently accessed ones

  const recommendations: FileMetadata[] = []

  // Recommend files with similar tags
  const preferredTags = userPreferences.topTags.slice(0, 3)
  recentFiles.forEach(file => {
    if (file.tags?.some(tag => preferredTags.includes(tag))) {
      recommendations.push(file)
    }
  })

  // Recommend files of preferred types
  const preferredTypes = userPreferences.topTypes.slice(0, 2)
  recentFiles.forEach(file => {
    if (preferredTypes.includes(file.type.split('/')[0])) {
      recommendations.push(file)
    }
  })

  return [...new Set(recommendations)].slice(0, 10)
}

function analyzeUserPreferences(files: FileMetadata[]) {
  const typeCount: Record<string, number> = {}
  const tagCount: Record<string, number> = {}

  files.forEach(file => {
    const type = file.type.split('/')[0]
    typeCount[type] = (typeCount[type] || 0) + 1

    file.tags?.forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })

  const topTypes = Object.entries(typeCount)
    .sort(([,a], [,b]) => b - a)
    .map(([type]) => type)

  const topTags = Object.entries(tagCount)
    .sort(([,a], [,b]) => b - a)
    .map(([tag]) => tag)

  return { topTypes, topTags }
}

// Automated file organization suggestions
export async function suggestOrganization(files: FileMetadata[]): Promise<{
  suggestedFolders: string[]
  fileToFolderMapping: Record<string, string>
}> {
  const suggestedFolders: string[] = []
  const fileToFolderMapping: Record<string, string> = {}

  // Group files by type
  const typeGroups: Record<string, FileMetadata[]> = {}
  files.forEach(file => {
    const type = file.type.split('/')[0]
    if (!typeGroups[type]) typeGroups[type] = []
    typeGroups[type].push(file)
  })

  // Create folders for each type with multiple files
  Object.entries(typeGroups).forEach(([type, typeFiles]) => {
    if (typeFiles.length > 1) {
      const folderName = `${type.charAt(0).toUpperCase() + type.slice(1)}s`
      suggestedFolders.push(folderName)

      typeFiles.forEach(file => {
        fileToFolderMapping[file.id] = folderName
      })
    }
  })

  // Group by tags
  const tagGroups: Record<string, FileMetadata[]> = {}
  files.forEach(file => {
    file.tags?.forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = []
      tagGroups[tag].push(file)
    })
  })

  // Create folders for tags with multiple files
  Object.entries(tagGroups).forEach(([tag, tagFiles]) => {
    if (tagFiles.length > 2 && !suggestedFolders.includes(tag)) {
      suggestedFolders.push(tag)
      tagFiles.forEach(file => {
        fileToFolderMapping[file.id] = tag
      })
    }
  })

  return { suggestedFolders, fileToFolderMapping }
}