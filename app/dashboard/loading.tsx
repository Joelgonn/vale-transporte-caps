export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-200 border-t-accent-600" />
        <p className="text-sm text-zinc-500">Carregando painel...</p>
      </div>
    </div>
  );
}