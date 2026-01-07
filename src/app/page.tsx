import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)]">
            Business Loan Broker Portal
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Apply for funding, upload documents, and track your application status all in one place.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/auth/signup"
            className="w-full sm:w-auto rounded-lg bg-[var(--color-accent)] px-6 py-3 text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm hover:shadow-md"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="w-full sm:w-auto rounded-lg border border-[var(--color-border)] px-6 py-3 text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
