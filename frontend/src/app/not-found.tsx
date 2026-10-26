import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRODUCT_NAME } from '@/lib/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <FileQuestion className="h-7 w-7" />
      </div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">
        404
      </p>
      <h1 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
        That link doesn&apos;t exist in {PRODUCT_NAME}. Head back to your
        dashboard or the home page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
