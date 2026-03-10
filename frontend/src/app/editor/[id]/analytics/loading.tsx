export default function AnalyticsLoading() {
  return (
    <div className="container max-w-6xl py-8 animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
