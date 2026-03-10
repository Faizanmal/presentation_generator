export default function SettingsLoading() {
  return (
    <div className="container max-w-5xl py-8 animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );
}
