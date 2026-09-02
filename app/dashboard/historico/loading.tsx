import { CARTAO, CONTAINER } from "@/components/ui/visual-tokens";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col py-8">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`${CARTAO} p-4`}><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-7 w-16" /></div>
          <div className={`${CARTAO} p-4`}><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-7 w-16" /></div>
          <div className={`${CARTAO} p-4`}><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-7 w-16" /></div>
        </div>
        <div className={`${CARTAO} p-4`}>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className={`${CARTAO} p-6`}>
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
