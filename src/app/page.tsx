import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center px-4">
        <h1 className="text-4xl font-bold text-primary mb-4">
          CWI Facades
        </h1>
        <h2 className="text-xl text-gray-600 mb-8">
          Timesheet Management System
        </h2>

        <div className="space-y-4">
          <Link
            href="/operatives/login"
            className="block w-full px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors font-medium"
          >
            Operatives Login
          </Link>

          <p className="text-sm text-muted mt-8">
            Employees can log in to submit their daily hours worked.
            <br />
            Contact admin if you need an account.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted">
            Internal use only - CWI Facades Ltd
          </p>
        </div>
      </div>
    </div>
  );
}
