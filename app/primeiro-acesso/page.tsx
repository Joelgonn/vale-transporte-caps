import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PrimeiroAcessoForm from "./primeiro-acesso-form";
import { createClient } from "@/lib/supabase/server";
import { MarcaIcone } from "@/components/ui/marca";
import { CONTAINER } from "@/components/ui/visual-tokens";

export const metadata: Metadata = {
  title: "Primeiro acesso | Vale Transporte CAPS",
  description:
    "Defina uma nova senha para concluir seu primeiro acesso ao sistema de gestão do vale-transporte do CAPS.",
};

export default async function PrimeiroAcessoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fprimeiro-acesso");
  }

  // Só usuários com primeiro acesso pendente veem esta tela; quem já trocou é
  // levado ao dashboard (evita loops e telas desnecessárias).
  const pendente = user.app_metadata?.precisa_trocar_senha === true;
  if (!pendente) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-900/[0.06] bg-white/85 backdrop-blur-md">
        <div className={`${CONTAINER} flex h-16 items-center`}>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg text-base font-semibold text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <MarcaIcone className="h-8 w-8" />
            <span>
              <span className="text-accent-600">Vale</span> Transporte CAPS
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(16,32,58,0.04),0_24px_50px_-24px_rgba(16,32,58,0.25)] ring-1 ring-zinc-900/[0.06] sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="w-fit rounded-full border border-accent-200 bg-accent-50/70 px-3 py-1 text-xs font-medium text-accent-700">
              Primeiro acesso
            </p>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-brand-900">
                Defina sua nova senha
              </h1>
              <p className="text-sm leading-5 text-zinc-500">
                Por segurança, você precisa definir uma nova senha antes de
                continuar.
              </p>
            </div>
          </div>
          <PrimeiroAcessoForm />
        </div>
      </main>

      <footer className="border-t border-zinc-900/[0.06] bg-white">
        <div className={`${CONTAINER} flex h-14 items-center justify-center`}>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} Vale Transporte CAPS
          </p>
        </div>
      </footer>
    </div>
  );
}
