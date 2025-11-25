export default function FileManager() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">File Manager</h1>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Your Files</h2>
            <div className="flex gap-3">
              <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
              </button>
              <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Sort
              </button>
              <a href="/upload" className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Upload New
              </a>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <p className="font-medium">document.pdf</p>
                <p className="text-sm text-gray-500">2.5 MB</p>
              </div>
              <div className="flex space-x-2">
                <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-3 py-1 rounded text-sm">
                  View
                </button>
                <button className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded text-sm">
                  Share
                </button>
                <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                  Delete
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <p className="font-medium">image.jpg</p>
                <p className="text-sm text-gray-500">1.8 MB</p>
              </div>
              <div className="flex space-x-2">
                <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-3 py-1 rounded text-sm">
                  View
                </button>
                <button className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded text-sm">
                  Share
                </button>
                <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}