import Link from "next/link";
import { Fragment } from "react";
import {
  ACAO_PRINCIPAL,
  CARTAO,
} from "@/components/ui/visual-tokens";
import { CardGlow } from "@/components/ui/card-glow";
import ModuleCard from "@/components/dashboard/module-card";
import { ICONES_MODULO } from "@/components/dashboard/icones";
import { ROTULO_PERFIL, type PerfilUsuario } from "@/lib/domain/enums";
import { capacidadeDashboard, estadoUsuario } from "@/lib/domain/regras";
import {
  acoesRapidasPorPerfil,
  modulosPorCapacidade,
  type AcaoRapida,
} from "@/components/dashboard/navegacao";

type DashboardHomeProps = {
  email: string;
  perfil: PerfilUsuario | null;
  statusAtivo: boolean | null;
};

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function ChipEstado({ estado, rotulo }: { estado: string; rotulo: string | null }) {
  if (estado === "ativo" && rotulo) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15">
        {rotulo}
      </span>
    );
  }
  if (estado === "inativo") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-400/20">
        Usuário inativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/15">
      Sem perfil funcional
    </span>
  );
}

function FluxoVisual() {
  const etapas = [
    {
      label: "Identificação",
      icone: (
        <path d="M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 20a7 7 0 0 1 14 0" />
      ),
    },
    {
      label: "Liberação",
      icone: <path d="M5 12.5 9.5 17 19 7" />,
    },
    {
      label: "Retirada",
      icone: <path d="M4 20h16M6 20V8h12v12M9 8V6a3 3 0 0 1 6 0v2" />,
    },
  ];

  return (
    <div className="hidden lg:block" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        {etapas.map((etapa, i) => (
          <Fragment key={etapa.label}>
            <div className="flex flex-1 flex-col items-center gap-2.5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/15 transition-transform duration-200 ease-out hover:scale-[1.06] motion-reduce:transition-none motion-reduce:hover:scale-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {etapa.icone}
                </svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100 transition-colors duration-200 hover:text-white motion-reduce:transition-none">
                {etapa.label}
              </p>
            </div>
            {i < etapas.length - 1 && (
              <span className="mt-3.5 shrink-0 text-accent-400/60 transition-transform duration-200 ease-out hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:hover:translate-x-0">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-brand-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
        Rastreável e auditável
      </p>
    </div>
  );
}

function AcaoPrincipal({ acao }: { acao: AcaoRapida }) {
  return (
    <Link href={acao.href} className={ACAO_PRINCIPAL}>
      <CardGlow cor="branco" className="rounded-2xl" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl transition-transform duration-[250ms] ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {ICONES_MODULO[acao.icone]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold tracking-tight text-white">
          {acao.rotulo}
        </span>
        <span className="block truncate text-xs text-white/80">
          {acao.descricao}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-white/90 transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

function AcaoRegular({ acao }: { acao: AcaoRapida }) {
  return (
    <Link
      href={acao.href}
      className="group relative flex h-full items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-900/[0.05] shadow-[0_1px_2px_rgba(16,32,58,0.03)] transition-[transform,box-shadow,ring-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(16,32,58,0.22)] hover:ring-accent-400/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:ring-zinc-900/[0.05]"
    >
      <CardGlow cor="accent" className="rounded-2xl" />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-brand-700 ring-1 ring-zinc-900/[0.04] transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:bg-accent-50 group-hover:text-accent-700 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:bg-zinc-100 motion-reduce:group-hover:text-brand-700">
        {ICONES_MODULO[acao.icone]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-900">
          {acao.rotulo}
        </span>
        <span className="block truncate text-xs text-zinc-500">
          {acao.descricao}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-zinc-300 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-600 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:text-zinc-300"
      >
        →
      </span>
    </Link>
  );
}

// Home do Dashboard (Sprint 30) — recomposição: hero institucional + ação
// principal + módulos com pesos distintos + visão geral. Nenhuma métrica ou dado
// fictício: o hero representa o sistema com elementos abstratos do fluxo.
export default function DashboardHome({
  email,
  perfil,
  statusAtivo,
}: DashboardHomeProps) {
  const estado = estadoUsuario(perfil, statusAtivo);
  const capacidade = capacidadeDashboard(perfil, statusAtivo);
  const modulos = modulosPorCapacidade(capacidade);
  const acoes = acoesRapidasPorPerfil(perfil, statusAtivo);
  const rotulo = perfil ? ROTULO_PERFIL[perfil] : null;

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section
          aria-labelledby="dashboard-titulo"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-950 to-brand-800 shadow-[0_24px_50px_-24px_rgba(16,32,58,0.5)]"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-500/20 blur-3xl" />
            <div className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="absolute right-10 top-8 h-14 w-14 rotate-12 rounded-2xl bg-white/5 ring-1 ring-white/10" />
            <div className="absolute right-44 top-20 h-8 w-8 rounded-full border-[10px] border-white/10" />
          </div>
          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-10 lg:p-10">
            <div className="flex flex-col items-start gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-400/30 bg-accent-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent-200">
                Controle institucional
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  id="dashboard-titulo"
                  className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                >
                  {saudacao()}!
                </h1>
                <ChipEstado estado={estado} rotulo={rotulo} />
              </div>
              <p className="text-sm leading-6 text-brand-100 sm:text-base">
                O que você precisa fazer hoje?
              </p>
            </div>
            <FluxoVisual />
          </div>
        </section>

        {estado !== "ativo" ? (
          <section className={CARTAO}>
            <div className="flex flex-col gap-2 p-6">
              <h2 className="text-base font-semibold text-brand-900">
                Acesso não configurado
              </h2>
              <p className="text-sm leading-6 text-zinc-600">
                {estado === "inativo"
                  ? "Seu usuário está inativo. Procure a gestão do CAPS para regularizar o acesso."
                  : "Seu usuário autenticado ainda não possui perfil funcional configurado. Procure a gestão do CAPS para regularizar o acesso."}
              </p>
            </div>
          </section>
        ) : (
          <>
            {acoes.length > 0 && (
              <section aria-labelledby="dashboard-acoes-rapidas">
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id="dashboard-acoes-rapidas"
                    className="text-lg font-bold tracking-tight text-brand-900"
                  >
                    Ações rápidas
                  </h2>
                </div>
                <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {acoes.map((acao, i) => (
                    <li key={`${acao.href}-${acao.rotulo}`}>
                      {i === 0 ? <AcaoPrincipal acao={acao} /> : <AcaoRegular acao={acao} />}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="dashboard-modulos">
              <h2
                id="dashboard-modulos"
                className="text-lg font-bold tracking-tight text-brand-900"
              >
                Módulos
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modulos.map((modulo, i) => (
                  <ModuleCard
                    key={modulo.slug}
                    href={modulo.href}
                    titulo={modulo.rotulo}
                    descricao={modulo.descricao}
                    icone={ICONES_MODULO[modulo.slug]}
                    destaque={i === 0}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="dashboard-visao" className="max-w-2xl">
              <h2
                id="dashboard-visao"
                className="text-lg font-bold tracking-tight text-brand-900"
              >
                Visão geral da conta
              </h2>
              <dl className={`mt-4 divide-y divide-zinc-100 ${CARTAO}`}>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-zinc-500">Perfil</dt>
                  <dd className="text-sm font-medium text-brand-900">{rotulo ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-zinc-500">Situação</dt>
                  <dd className="text-sm font-medium text-emerald-700">Ativo</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-zinc-500">E-mail</dt>
                  <dd className="truncate text-sm font-medium text-brand-900">{email}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  );
}