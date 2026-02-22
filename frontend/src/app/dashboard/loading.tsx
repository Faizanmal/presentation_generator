export default function DashboardLoading() {
  return (
    <div className="flex-1 p-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );
}
