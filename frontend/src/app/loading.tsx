export default function RootLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 animate-pulse" />
        <div className="h-2 w-32 rounded-full bg-slate-800 animate-pulse" />
      </div>
    </div>
  );
}
