import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">Business Loan Broker Portal</h1>
      <p className="text-[var(--color-text-secondary)]">
        Apply for funding, upload documents, and track your application status.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/signup"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Sign up
        </Link>
        <Link
          href="/auth/login"
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
