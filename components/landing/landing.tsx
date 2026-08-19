import Link from "next/link";
import { Fragment } from "react";
import MobileNav from "./mobile-nav";
import { MarcaIcone, MarcaSistema } from "@/components/ui/marca";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CONTAINER,
  EYEBROW,
  NAV_LINK,
  SUBTITULO,
  TITULO_SECAO,
} from "@/components/ui/visual-tokens";

/* Identidade visual institucional – Landing (Sprint 29, linguagem premium).
  Paleta do sistema (globals.css @theme): azul institucional (brand) para
  marca/títulos/estrutura, turquesa (accent) para destaques e verde (success)
  para as ações primárias. A página mantém os textos e âncoras institucionais
  testados e não inventa dados. */

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900/[0.06] bg-white/85 backdrop-blur-md">
      <div className={CONTAINER}>
        <div className="flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
          <MarcaSistema href="#inicio" />
          <div className="flex items-center gap-2">
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Navegação da página"
            >
              {[
                { href: "#inicio", label: "Início" },
                { href: "#organiza", label: "O que organiza" },
                { href: "#fluxo", label: "Como funciona" },
                { href: "#seguranca", label: "Segurança" },
                { href: "#fluxo", label: "Fluxo" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`${NAV_LINK} text-sm text-zinc-600`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <span className="hidden sm:inline-flex">
              <Link
                href="/login"
                className={`${BOTAO_PRIMARIO} whitespace-nowrap px-5 py-2.5`}
              >
                Entrar no sistema
              </Link>
            </span>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroVisual() {
  const etapas = [
    {
      titulo: "Identificação",
      texto: "beneficiário reconhecido",
      icone: (
        <path d="M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 20a7 7 0 0 1 14 0" />
      ),
    },
    {
      titulo: "Autorização",
      texto: "registrada pela equipe",
      icone: <path d="M5 12.5 9.5 17 19 7" />,
    },
    {
      titulo: "Registro",
      texto: "entrega controlada",
      icone: (
        <path d="M4 20h16M6 20V8h12v12M9 8V6a3 3 0 0 1 6 0v2" />
      ),
    },
  ];

  return (
    <div
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
      aria-hidden="true"
    >
      {/* Glow e camadas de fundo */}
      <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(55%_55%_at_70%_15%,rgba(56,179,176,0.20),transparent_70%),radial-gradient(50%_50%_at_15%_85%,rgba(44,88,153,0.18),transparent_70%)] blur-2xl" />
      <div className="absolute -right-5 -top-7 h-28 w-28 rotate-12 rounded-3xl bg-gradient-to-br from-accent-200/70 to-accent-100/40" />
      <div className="absolute -bottom-7 -left-5 h-36 w-36 rounded-full border-[18px] border-brand-100/70" />
      <div className="absolute right-12 top-12 h-12 w-12 rounded-2xl bg-brand-100/60" />
      <div className="absolute bottom-16 right-6 h-8 w-8 rounded-full bg-accent-200/50" />

      {/* Card principal */}
      <div className="relative rounded-3xl bg-white/90 p-6 shadow-[0_24px_60px_-24px_rgba(28,49,80,0.35)] ring-1 ring-white/80 backdrop-blur-sm sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MarcaIcone className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-900">
                Vale Transporte CAPS
              </p>
              <p className="text-xs text-zinc-500">Painel do benefício</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Rastreável
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-1.5">
          {etapas.map((etapa, i) => (
            <Fragment key={etapa.titulo}>
              <div className="flex items-center gap-4 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-900/[0.05] shadow-[0_1px_2px_rgba(16,32,58,0.04)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-md shadow-brand-900/20">
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
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">
                    {etapa.titulo}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{etapa.texto}</p>
                </div>
              </div>
              {i < etapas.length - 1 && (
                <div className="flex justify-center text-brand-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 px-4 py-3">
          <p className="text-xs font-medium text-brand-100">
            Controle institucional
          </p>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-accent-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden border-b border-zinc-900/[0.06] bg-white"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand-50 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-accent-50/70 blur-3xl" />
      </div>
      <div className={CONTAINER}>
        <div className="relative flex flex-col-reverse items-center gap-12 py-16 sm:py-20 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start">
            <span className={EYEBROW}>Sistema institucional</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-900 sm:text-5xl lg:text-6xl">
              Vale Transporte{" "}
              <span className="bg-gradient-to-r from-accent-500 to-accent-700 bg-clip-text text-transparent">
                CAPS
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 sm:text-xl sm:leading-9">
              Gestione pacientes, liberações e retiradas com clareza, segurança
              e rastreabilidade.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className={`${BOTAO_PRIMARIO} px-7 py-3.5 text-base`}
              >
                Entrar no sistema
              </Link>
              <a href="#fluxo" className={`${BOTAO_SECUNDARIO} px-7 py-3.5 text-base`}>
                Como funciona →
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              {[
                {
                  rotulo: "Controle",
                  icone: (
                    <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
                  ),
                },
                {
                  rotulo: "Segurança",
                  icone: (
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                  ),
                },
                {
                  rotulo: "Rastreabilidade",
                  icone: (
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  ),
                },
              ].map((item) => (
                <li key={item.rotulo} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-900/[0.06]">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {item.icone}
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-zinc-600">
                    {item.rotulo}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

const MODULOS = [
  {
    icone: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    titulo: "Pacientes",
    texto:
      "Cadastro e acompanhamento dos beneficiários, com status do direito ao benefício e período de acompanhamento.",
  },
  {
    icone: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    ),
    titulo: "Liberações",
    texto:
      "Autorização do benefício pelo profissional responsável — contínua ou avulsa — com período e quantidade definidos.",
  },
  {
    icone: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 20h16M6 20V8h12v12M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    ),
    titulo: "Retiradas",
    texto:
      "Registro das retiradas na recepção, sempre dentro do período e da quantidade autorizada na liberação.",
  },
  {
    icone: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
      </svg>
    ),
    titulo: "Usuários",
    texto:
      "Gestão dos profissionais que acessam o sistema, com perfil e situação de atividade controlados pela gestão.",
  },
  {
    icone: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </svg>
    ),
    titulo: "Auditoria",
    texto:
      "Registro das ações relevantes realizadas no sistema, para consulta e acompanhamento pela gestão.",
  },
];

function SecaoOrganiza() {
  return (
    <section id="organiza" className="scroll-mt-24 bg-zinc-50">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-12 py-16 sm:py-24">
          <div className="flex max-w-2xl flex-col gap-4">
            <span className={EYEBROW}>Módulos</span>
            <h2 className={TITULO_SECAO}>O que o sistema organiza</h2>
            <p className={SUBTITULO}>
              Um conjunto de módulos que acompanham o benefício do cadastro à
              retirada, com papéis claros para quem utiliza.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((modulo) => (
              <li
                key={modulo.titulo}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-white p-6 ring-1 ring-zinc-900/[0.06] shadow-[0_1px_2px_rgba(16,32,58,0.04),0_12px_28px_-18px_rgba(16,32,58,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(16,32,58,0.22)]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent-500 to-accent-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-md shadow-brand-900/20 transition-transform duration-300 group-hover:-translate-y-0.5">
                  {modulo.icone}
                </div>
                <h3 className="text-base font-semibold text-brand-900">
                  {modulo.titulo}
                </h3>
                <p className="text-sm leading-6 text-zinc-600">{modulo.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SecaoSeguranca() {
  return (
    <section
      id="seguranca"
      className="relative scroll-mt-24 overflow-hidden border-y border-zinc-900/[0.06] bg-white"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-50/60 blur-3xl" />
      </div>
      <div className={CONTAINER}>
        <div className="relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
          <div className="flex max-w-2xl flex-col gap-4">
            <span className={EYEBROW}>Segurança</span>
            <h2 className={TITULO_SECAO}>Controle e segurança</h2>
            <p className={SUBTITULO}>
              O sistema foi desenhado para separar responsabilidades e garantir
              que cada ação seja feita por quem tem permissão para fazê-la.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              "Acesso conforme o perfil: cada profissional enxerga e executa apenas o que o seu papel permite.",
              "Usuários ativos: usuários inativos não executam operações operacionais no sistema.",
              "Permissões aplicadas na camada de dados, além da interface.",
              "Auditoria: as ações relevantes ficam registradas e são consultáveis pela gestão.",
              "Proteção de informações sensíveis, que não ficam expostas nas telas comuns.",
            ].map((principio, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-900/[0.05]"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                </span>
                <p className="text-sm leading-6 text-zinc-600">{principio}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SecaoFluxo() {
  const etapas = [
    {
      numero: "1",
      label: "Paciente",
      texto: "identificado com direito ao benefício",
    },
    {
      numero: "2",
      label: "Liberação",
      texto: "autorizada pelo profissional responsável",
    },
    {
      numero: "3",
      label: "Retirada",
      texto: "registrada na recepção dentro da validade",
    },
    {
      numero: "4",
      label: "Auditoria",
      texto: "registável e consultável pela gestão",
    },
  ];

  return (
    <section id="fluxo" className="scroll-mt-24 bg-zinc-50">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-12 py-16 sm:py-24">
          <div className="flex max-w-2xl flex-col gap-4">
            <span className={EYEBROW}>Etapas</span>
            <h2 className={TITULO_SECAO}>Como o benefício flui</h2>
            <p className={SUBTITULO}>
              O sistema acompanha o fluxo operacional do benefício de ponta a
              ponta.
            </p>
          </div>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {etapas.map((etapa, i) => (
              <li key={etapa.label} className="relative">
                <div className="flex h-full flex-col gap-3 rounded-3xl bg-white p-6 ring-1 ring-zinc-900/[0.06] shadow-[0_1px_2px_rgba(16,32,58,0.04),0_12px_28px_-18px_rgba(16,32,58,0.10)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-600 text-sm font-bold text-white shadow-md shadow-accent-600/25">
                    {etapa.numero}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-brand-900">
                    {etapa.label}
                  </h3>
                  <p className="text-sm leading-6 text-zinc-600">{etapa.texto}</p>
                </div>
                {i < etapas.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-brand-400 lg:block"
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
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section id="acesso" className="relative scroll-mt-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-950 to-brand-800" aria-hidden="true" />
      <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden="true" />
      <div className={CONTAINER}>
        <div className="relative flex flex-col items-start gap-6 py-16 sm:items-center sm:py-24 sm:text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent-200">
            Acesso institucional
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Continue o acompanhamento
          </h2>
          <p className="max-w-xl text-base leading-7 text-brand-100">
            Acesse o sistema com suas credenciais institucionais para trabalhar
            com pacientes, liberações e retiradas.
          </p>
          <Link
            href="/login"
            className={`${BOTAO_PRIMARIO} mt-2 px-8 py-3.5 text-base`}
          >
            Entrar no sistema
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const ano = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-900/[0.06] bg-zinc-50">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <MarcaSistema href="#inicio" />
            <p className="text-sm leading-6 text-zinc-600">
              Sistema institucional de gestão do vale-transporte de
              acompanhamento.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-brand-900">Acesso</p>
            <Link
              href="/login"
              className="text-sm font-medium text-accent-600 underline-offset-2 hover:text-accent-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Entrar no sistema
            </Link>
          </div>
        </div>
        <p className="border-t border-zinc-900/[0.06] py-6 text-xs text-zinc-500">
          © {ano} Vale Transporte CAPS
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <Header />
      <main className="flex flex-1 flex-col">
        <Hero />
        <SecaoOrganiza />
        <SecaoSeguranca />
        <SecaoFluxo />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}
