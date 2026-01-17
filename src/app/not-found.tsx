import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md w-full p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
            404 - Page Not Found
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            The page you're looking for doesn't exist.
          </p>
          <Link href="/dashboard">
            <Button variant="primary">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}


