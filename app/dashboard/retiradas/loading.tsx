export default function CarregandoRetiradas() {
  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h-7 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-200" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}