export default function EditorLoading() {
  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 animate-pulse">
      {/* Slide panel skeleton */}
      <div className="w-52 border-r bg-white dark:bg-slate-950 flex flex-col gap-3 p-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 rounded bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      {/* Canvas skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-180 h-112 rounded-2xl bg-slate-200 dark:bg-slate-700" />
      </div>
      {/* Properties panel skeleton */}
      <div className="w-64 border-l bg-white dark:bg-slate-950 flex flex-col gap-3 p-3">
        <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-32 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-24 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
