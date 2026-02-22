export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center animate-pulse">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-800" />
          <div className="h-7 w-48 rounded bg-slate-800" />
          <div className="h-4 w-64 rounded bg-slate-800" />
        </div>
        <div className="space-y-4 bg-slate-900 rounded-2xl p-6">
          <div className="h-10 rounded-lg bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
