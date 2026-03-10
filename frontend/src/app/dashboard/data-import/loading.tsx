export default function SubpageLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 w-56 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );
}
