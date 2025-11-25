export default function Sharing() {
  const sharedFiles = [
    {
      id: 1,
      name: "project-document.pdf",
      sharedWith: ["alice@example.com", "bob@example.com"],
      permissions: "view",
      expiresAt: "2024-12-31",
      link: "https://privora12.com/share/abc123"
    },
    {
      id: 2,
      name: "presentation.pptx",
      sharedWith: ["team@company.com"],
      permissions: "download",
      expiresAt: "2024-11-30",
      link: "https://privora12.com/share/def456"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">File Sharing</h1>

          {/* Create Share Link */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Create Share Link</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select File</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700">
                  <option>Select a file...</option>
                  <option>project-document.pdf</option>
                  <option>presentation.pptx</option>
                  <option>spreadsheet.xlsx</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permissions</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700">
                  <option value="view">View Only</option>
                  <option value="download">Allow Download</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password Protection</label>
                <input
                  type="password"
                  placeholder="Optional password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiration Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="mt-4">
              <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium">
                Generate Share Link
              </button>
            </div>
          </div>

          {/* Shared Files */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Your Shared Files</h2>

            {sharedFiles.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No files shared yet.</p>
            ) : (
              <div className="space-y-4">
                {sharedFiles.map((file) => (
                  <div key={file.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{file.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Shared with: {file.sharedWith.join(", ")}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Permissions: {file.permissions} • Expires: {file.expiresAt}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="text-primary-500 hover:text-primary-600 text-sm">
                          Copy Link
                        </button>
                        <button className="text-red-500 hover:text-red-600 text-sm">
                          Revoke Access
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm font-mono break-all">
                      {file.link}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}