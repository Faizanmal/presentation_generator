import { Skeleton } from "@/components/ui/skeleton";

export default function VideoRecordingLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((id) => (
          <Skeleton key={id} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
