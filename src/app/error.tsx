'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md w-full p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
            Something went wrong!
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={reset}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-light)] text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}


