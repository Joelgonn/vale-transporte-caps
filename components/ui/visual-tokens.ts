// components/ui/visual-tokens.ts
// Tokens visuais unificados do Vale Transporte CAPS (Sprint 29 — linguagem
// visual premium). Fonte única de verdade da paleta: app/globals.css (@theme,
// Sprint 24). Aqui só existem utilitários que o tema realmente gera (brand-*,
// accent-* e a escala padrão do Tailwind). Classes primary-*/secondary-* NÃO
// são usadas — elas não são geradas pelo @theme e por isso nunca deveriam
// entrar no código.

// Containers
export const CONTAINER =
  "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export const CONTEINER_PAINEL =
  "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

// Cards — superfície branca com profundidade sutil (ring + sombra leve).
// Foi removido o hover para que cada card defina seu próprio comportamento.
export const CARTAO =
  "rounded-2xl bg-white ring-1 ring-zinc-900/[0.06] shadow-[0_1px_2px_rgba(16,32,58,0.04),0_10px_24px_-16px_rgba(16,32,58,0.10)]";

// Microinterações (Sprint 33) — duração, easing e intensidade centralizados.
// FAST ≈ 150ms (elementos simples), STANDARD ≈ 200ms (cards), PREMIUM ≈ 250ms
// (glow/cursor). Nenhum valor aleatório espalhado e prefers-reduced-motion
// sempre respeitado: transformações e glows são removidos, mudanças essenciais
// de contraste/superfície são mantidas.
export const MOTION_FAST =
  "transition-all duration-150 ease-out motion-reduce:transition-none";
export const MOTION_STANDARD =
  "transition-all duration-200 ease-out motion-reduce:transition-none";
export const MOTION_PREMIUM =
  "transition-all duration-[250ms] ease-out motion-reduce:transition-none";

// Elevação padrão de cards interativos (Sprint 33): sobe 2px, sombra cresce
// sutilmente, active recolhe. Só transform/sombra são animados; a superfície
// permanece estável. Complementa CARTAO (que já define o repouso).
export const CARTAO_INTERATIVO =
  "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(16,32,58,0.24)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(16,32,58,0.04),0_10px_24px_-16px_rgba(16,32,58,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none";

// Links
export const LINK =
  "font-medium text-accent-600 underline-offset-2 transition-colors hover:text-accent-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

// Labels
export const ROTULO =
  "block text-sm font-medium text-brand-900 mb-1.5";

// Inputs
export const INPUT =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-brand-900 placeholder:text-zinc-400 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:opacity-50 disabled:cursor-not-allowed";

export const INPUT_ERRO =
  "w-full rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 placeholder:text-red-400 transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed";

// Botões
export const BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/30 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed";

export const BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-900 ring-1 ring-zinc-900/10 transition-all hover:bg-brand-50/60 hover:text-brand-700 hover:ring-brand-900/15 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed";

export const BOTAO_GHOST =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed";

// Botões de ação de status/negócio (Sprint 34) — inativar/reativar/renovar.
// Ações de negócio sem efeitos chamativos: só superfície + hover + foco.
// Nenhum feedback de sucesso é sugerido por animação — o resultado vem do
// servidor. Classe completa (sem conflitos); altura é acrescentada no uso.
export const BOTAO_AVISO =
  "inline-flex items-center justify-center rounded-md border border-amber-300 px-3.5 text-sm font-medium text-amber-700 transition-colors duration-150 ease-out hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none";

export const BOTAO_POSITIVO =
  "inline-flex items-center justify-center rounded-md bg-green-700 px-3.5 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none";

// CTA principal do dashboard (ação dominante) — superfície verde institucional.
// Todos os elementos internos usam a família branca: título branco puro,
// descrição branca com opacidade menor (hierarquia), ícone e seta brancos.
// Nenhum accent/azul/texto escuro entra nesta superfície. O fundo é um tom mais
// profundo de verde para garantir contraste dos textos claros (AA). Em
// prefers-reduced-motion as transformações do hover são removidas.
export const ACAO_PRINCIPAL =
  "group relative flex h-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-green-700 to-green-800 p-5 text-white shadow-[0_16px_36px_-18px_rgba(22,101,52,0.6)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:from-green-800 hover:to-green-900 hover:shadow-[0_22px_42px_-18px_rgba(22,101,52,0.65)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-950 active:translate-y-0 active:from-green-900 active:to-green-950 active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:from-green-700 motion-reduce:hover:to-green-800";

// Navegação (sidebar do dashboard).
// NAV_LINK é a base dos itens INATIVOS (neutro). NAV_LINK_ATIVO é uma classe
// COMPLETA e autossuficiente — substitui NAV_LINK quando o item está ativo —
// porque utilitários de texto somados (text-zinc-600 + text-white) têm a mesma
// especificidade e o vencedor depende da ordem no CSS compilado (causava texto
// cinza sobre o fundo brand). Estados ativos sempre: fundo brand, texto branco,
// ícone branco, indicador accent.
export const NAV_LINK =
  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-600 transition-all hover:bg-brand-50/70 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

export const NAV_LINK_ATIVO =
  "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-900/20 transition-all hover:from-brand-700 hover:to-brand-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400";

// Componentes de texto para seções institucionais (Landing)
export const EYEBROW =
  "inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/70 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent-700";

export const TITULO_SECAO =
  "text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl";

export const SUBTITULO =
  "text-base leading-7 text-zinc-600";

// Badges/Status
export const CHIP =
  "inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700";

export const BADGE_NEUTRO =
  "inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700";

export const BADGE_SUCESSO =
  "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700";

export const BADGE_ERRO =
  "inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700";

export const BADGE_ATENCAO =
  "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700";

export const BADGE_INFO =
  "inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700";

export const BADGE_PRIMARIO =
  "inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700";

export const BADGE_SECUNDARIO =
  "inline-flex items-center rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700";

// Alertas
export const ALERTA_ERRO =
  "rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-100";

export const ALERTA_SUCESSO =
  "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-100";

export const ALERTA_ATENCAO =
  "rounded-xl bg-amber-50 p-3 text-sm text-amber-700 border border-amber-100";

export const ALERTA_INFO =
  "rounded-xl bg-sky-50 p-3 text-sm text-sky-700 border border-sky-100";

// Tabelas
export const TABELA =
  "min-w-full divide-y divide-zinc-200 rounded-xl border border-zinc-200 overflow-hidden";

export const TABELA_CABECALHO =
  "bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500";

export const TABELA_CELULA =
  "px-4 py-3 text-sm text-zinc-700";
