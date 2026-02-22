export default function SettingsLoading() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="h-10 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
