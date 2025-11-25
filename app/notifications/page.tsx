export default function Notifications() {
  const notifications = [
    {
      id: 1,
      title: "File shared with you",
      message: "John Doe shared 'project-document.pdf' with you",
      time: "2 hours ago",
      read: false,
      type: "share"
    },
    {
      id: 2,
      title: "File download completed",
      message: "Your download of 'presentation.pptx' is ready",
      time: "1 day ago",
      read: true,
      type: "download"
    },
    {
      id: 3,
      title: "Security alert",
      message: "New login detected from Chrome on Windows",
      time: "2 days ago",
      read: true,
      type: "security"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Notifications</h1>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔔</div>
              <h2 className="text-xl font-semibold mb-2">No new notifications</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You're all caught up! We'll notify you when something important happens.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                    !notification.read
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{notification.title}</h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500">{notification.time}</p>
                    </div>
                    <div className="flex gap-2">
                      {!notification.read && (
                        <button className="text-primary-500 hover:text-primary-600 text-sm">
                          Mark as read
                        </button>
                      )}
                      <button className="text-gray-500 hover:text-gray-700 text-sm">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}