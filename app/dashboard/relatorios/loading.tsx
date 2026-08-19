export default function CarregandoRelatorios() {
  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <div className="h-7 w-44 animate-pulse rounded bg-zinc-200" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-10 w-28 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-10 w-28 animate-pulse rounded-md bg-zinc-200" />
        </div>
        <div className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-white" />
        <div className="h-64 animate-pulse rounded-lg border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}