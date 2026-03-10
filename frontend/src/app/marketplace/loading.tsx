export default function PageLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="space-y-4 w-full max-w-2xl animate-pulse px-6">
        <div className="h-10 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
