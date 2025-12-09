import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">Business Loan Broker Portal</h1>
      <p className="text-gray-600">
        Apply for funding, upload documents, and track your application status.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/signup"
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Sign up
        </Link>
        <Link
          href="/auth/login"
          className="rounded-md border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-100"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
