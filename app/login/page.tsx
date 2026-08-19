// app/login/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";
import { MarcaIcone } from "@/components/ui/marca";
import { CONTAINER } from "@/components/ui/visual-tokens";

export const metadata: Metadata = {
  title: "Entrar | Vale Transporte CAPS",
  description: "Acesse o sistema de vale transporte do CAPS",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-accent-50/40" />
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent-100/50 blur-3xl" />
      </div>

      <div className={`relative ${CONTAINER}`}>
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <MarcaIcone className="h-14 w-14 rounded-2xl shadow-lg shadow-brand-900/20" />
            </div>
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold tracking-tight text-brand-900">
                <span className="text-accent-600">Vale</span> Transporte CAPS
              </h1>
            </Link>
            <p className="mt-2 text-sm text-zinc-500">
              Sistema de gerenciamento de vale transporte
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(16,32,58,0.04),0_24px_50px_-24px_rgba(16,32,58,0.25)] ring-1 ring-zinc-900/[0.06] sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-brand-900">
                Entrar na sua conta
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Insira suas credenciais para acessar o sistema
              </p>
            </div>

            <LoginForm next={next} />
          </div>

          <div className="mt-6 text-center text-xs text-zinc-400">
            <p>
              © {new Date().getFullYear()} Vale Transporte. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
