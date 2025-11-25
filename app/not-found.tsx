export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl mb-8">Page Not Found</p>
        <p className="mb-8">The page you are looking for does not exist.</p>
        <a href="/" className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg">
          Go Home
        </a>
      </div>
    </div>
  );
}