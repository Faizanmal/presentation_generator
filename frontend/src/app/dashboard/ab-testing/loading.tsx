export default function SubpageLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
