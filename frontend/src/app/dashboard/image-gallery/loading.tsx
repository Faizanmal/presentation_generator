export default function SubpageLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );
}
