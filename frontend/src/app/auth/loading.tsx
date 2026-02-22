export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
          <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="h-4 w-2 rounded-full bg-blue-500 animate-bounce" />
        <p className="text-slate-400 text-sm animate-pulse">Signing you in…</p>
      </div>
    </div>
  );
}
