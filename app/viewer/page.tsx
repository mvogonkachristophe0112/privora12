export default function Viewer() {
  // This would typically receive file ID as a query parameter
  const file = {
    id: "1",
    name: "sample-document.pdf",
    type: "pdf",
    size: "2.5 MB",
    uploadedAt: "2024-11-20",
    sharedBy: "John Doe"
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold mb-2">{file.name}</h1>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Size: {file.size}</p>
                  <p>Uploaded: {file.uploadedAt}</p>
                  <p>Shared by: {file.sharedBy}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm">
                  Download
                </button>
                <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg text-sm">
                  Share
                </button>
                <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* File Viewer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
              {file.type === 'pdf' ? (
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg font-medium">PDF Document</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    PDF viewer would be embedded here
                  </p>
                </div>
              ) : file.type === 'image' ? (
                <div className="text-center">
                  <div className="text-6xl mb-4">🖼️</div>
                  <p className="text-lg font-medium">Image File</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Image viewer would be embedded here
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-lg font-medium">File Preview</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    File preview would be shown here
                  </p>
                </div>
              )}
            </div>

            {/* File Actions */}
            <div className="flex justify-center gap-4">
              <button className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
              <button className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
              <button className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}