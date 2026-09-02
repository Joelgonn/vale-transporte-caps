import { CARTAO, CONTAINER } from "@/components/ui/visual-tokens";
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className ?? ""}`} />;
}
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col py-8">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className={`${CARTAO} p-6`}><Skeleton className="h-32 w-full" /></div>
      </div>
    </div>
  );
}
