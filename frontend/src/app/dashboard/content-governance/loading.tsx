import { Skeleton } from "@/components/ui/skeleton";

export default function ContentGovernanceLoading() {
  const skeletonCards = [1, 2, 3];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {skeletonCards.map((id) => (
          <Skeleton key={id} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-100 rounded-xl" />
    </div>
  );
}
