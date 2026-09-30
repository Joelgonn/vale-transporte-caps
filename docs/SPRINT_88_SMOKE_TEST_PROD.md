# Sprint 88 — Smoke Test Operacional no PROD

Data/hora (UTC): 2026-09-30.
Natureza: HOMOLOGAÇÃO OPERACIONAL DO PROD, somente leitura. Nenhum deploy,
nenhuma alteração de código, migration, RLS, SQL no PROD, dado real,
usuário, secret ou commit funcional. Nenhuma senha/token/service_role/PII
neste relatório.

## 1. Identificação

- Data/hora: 2026-09-30 (UTC).
- HEAD: `950e597 docs: sprint 87 pre-go operacional (diagnostico, sem alteracao funcional)`.
- Branch: `main` — 16 commits à frente de `origin/main`, 0 atrás; árvore limpa
  (`git status --short` vazio; `git diff --stat` vazio).
- Últimos commits: `950e597` (Sprint 87), `6628f1f` (release checklist),
  `4a91613` (audit counters), `7e04306` (history filters), `7e4d3a3` (release permission tests).
- Domínio PROD: `https://vale-transporte-caps.vercel.app` (HTTPS válido, página
  institucional + `/login` carregam via fetch; ver Fase 1).
- Projeto Vercel: `vale-transporte-caps` (`orgId team_ecUTQWNGP2O4BZZ610XGu6eC`,
  `projectId prj_I9F0lbJ6IaAdwqK8orLEi9XPfb20` — somente vinculação local
  `.vercel/project.json`; deploy/commit implantado, envs de Production e status
  do último deploy NÃO confirmados por falta de token/sessão — pendência P1 herdada).
- Supabase PROD: projeto `asirrtudqukpwimtrrhi` (referência Sprint 87; nenhuma
  conexão nova aberta neste sprint, por regra "NÃO executar SQL no PROD").
- PostgreSQL: 17.6 (auditoria SQL manual Sprint 86; não revalidado neste sprint).
- Volumes conhecidos (Sprint 87, REST somente leitura, sem PII): pacientes=4,
  liberações=1, retiradas=1, usuários=4, auditoria_logs=20. Não reconsultados
  neste sprint (regra do sprint); ver Fase 14.

## 2. Baseline

- `git status --short`: vazio (limpo).
- `git rev-parse --short HEAD`: `950e597`.
- `git log -5 --oneline`: `950e597 / 6628f1f / 4a91613 / 7e04306 / 7e4d3a3`.
- `git branch --show-current`: `main`.
- Testes: NÃO reexecutados neste sprint (ambiente local com `npm.ps1` bloqueado
  por ExecutionPolicy; `node v26.5.1` presente). Referência válida Sprint 87:
  64 files, 815 passed / 0 failed / 0 skipped.
- Lint: NÃO reexecutado neste sprint. Referência Sprint 87: 0 errors / 12 warnings.
- Build: NÃO reexecutado neste sprint (`next build` não rodado; nenhum deploy).
  Referência Sprint 87: OK, 14 rotas (`/`, `/_not-found`, `/dashboard` + 7 sub-rotas,
  `/login`, `/primeiro-acesso` + middleware).
- Nenhum commit feito neste sprint antes/durante a validação (somente este
  relatório documental ao final, se autorizado).

## 3. Autenticação

Login interativo no navegador com credenciais reais NÃO executado nesta sessão
(sem credenciais disponíveis no ambiente do agente, sem browser automatizado
com sessão autenticada; regra do sprint proíbe fabricar dados/usuários).
Validação estática do código (somente leitura) — todas PASS como desenho:

| Perfil | Login | Dashboard | Identificação perfil | Navegação | Logout/Novo login | Veredito operacional |
|---|---|---|---|---|---|---|
| Gestor | NOT TESTED (browser) | NOT TESTED (browser) | PASS (estático) | PASS (estático) | NOT TESTED | NOT TESTED |
| Profissional Autorizador | NOT TESTED (browser) | NOT TESTED (browser) | PASS (estático) | PASS (estático) | NOT TESTED | NOT TESTED |
| Recepcionista | NOT TESTED (browser) | NOT TESTED (browser) | PASS (estático) | PASS (estático) | NOT TESTED | NOT TESTED |

Evidência estática (desenho confirmado, sem executar escrita):
- `app/login/page.tsx:13-18` + `app/login/login-form.tsx:35-76` + `app/actions/auth.ts:37-79`
  (signInWithPassword, anti-open-redirect, `precisa_trocar_senha` → `/primeiro-acesso`).
- `proxy.ts:4-60` (protege `/dashboard/**`, redireciona anônimo → `/login?next=`).
- `app/dashboard/layout.tsx:11-37` + `app/dashboard/page.tsx:7-24` (double-guard + `getUsuarioFuncional`).
- `lib/auth/profile.ts:34-60` (perfil 100% via RPCs `perfil_atual/usuario_ativo_atual/usuario_atual_id`
  sobre `public.usuarios`; sem `user_metadata`, sem select direto).
- Nenhuma senha impressa. Nenhum login real tentado.

## 4. Matriz de acesso

Validada estaticamente em `lib/domain/regras.ts` + `components/dashboard/navegacao.ts` +
`components/dashboard/dashboard-shell.tsx` + guards server por página. Navegador
interativo NOT TESTED (sem sessão); desenho abaixo é o esperado e está travado por testes.

| Funcionalidade | Gestor | Autorizador | Recepcionista |
|---|---|---|---|
| Dashboard | SIM (`capacidadeDashboard`, ativo) | SIM | SIM |
| Pacientes (ver) | SIM | SIM | SIM |
| Pacientes (criar regular) | SIM | SIM | NÃO (só reutiliza) |
| Pacientes (criar esporádico) | SIM | SIM | SIM (só fluxo operacional) |
| Liberações (ver) | todas | todas | só `ativa` |
| Liberações (criar avulsa) | SIM | SIM | SIM |
| Liberações (criar contínua nova) | SIM | SIM | NÃO (BLOCKED 3 camadas) |
| Liberações (renovar) | NÃO | NÃO | SIM (com `renovacao_de_id`) |
| Atendimento | SIM | SIM | SIM |
| Retiradas (acessar/registrar) | SIM/SIM | SIM/SIM | SIM/SIM |
| Relatórios (inclui Histórico) | SIM | NÃO | NÃO |
| Histórico (`?tipo=historico`) | SIM (visão interna) | NÃO | NÃO |
| Auditoria | SIM | NÃO | NÃO |
| Usuários | SIM | NÃO | NÃO |

Evidências:
- `lib/domain/regras.ts:367-395` (pacientes), `:401-413` (usuários), `:432-463`
  (liberações), `:651-666` (retiradas), `:672-697` (auditoria/relatórios), `:715-748` (dashboard).
- `components/dashboard/navegacao.ts:41-100,124-195` + `dashboard-shell.tsx:48-100`
  (nav renderiza só módulos permitidos — UI-only, não é prova de segurança).
- Guards server (além de esconder botão): `app/dashboard/liberacoes/page.tsx:26-47`,
  `usuarios/page.tsx:23-45`, `auditoria/page.tsx:41-61`, `relatorios/page.tsx:40-59`,
  `atendimento/page.tsx:21-32` (early-return "Acesso restrito" sem consultar dados).
- Recepcionista/contínua: `app/actions/liberacoes.ts:155-160` (deny) +
  `supabase/migrations/20260904000001_sprint76_rls_recepcionista_continua.sql:38-49`
  (RLS `WITH CHECK tipo='avulsa' OR renovacao_de_id IS NOT NULL`) +
  `liberacoes-view.tsx:133,215-221,269-279` (UI).
- Auditoria: `app/actions/auditoria.ts:65-70` (deny não-gestor) +
  `supabase/migrations/20260811000009_rls.sql:174-182` (`auditoria_select_gestor`) +
  `lib/domain/auditoria/labels.ts:78-80,227-252` (CPF excluído da UI; testes
  `tests/domain/auditoria-labels.test.ts:98-102`, `tests/components/auditoria-view.test.tsx:155-164`).
- Histórico NÃO é rota `/dashboard/historico` (pasta inexistente, confirmado em disco);
  é `GET /dashboard/relatorios?tipo=historico&paciente=<id>`, herdando gate de gestor
  (`relatorios/page.tsx:101-140`; `lib/domain/regras.ts:744`; `tests/domain/navegacao.test.ts:43,163-167`).

## 5. Smoke test funcional

Legenda: PASS = confirmado nesta sessão (fetch ou estático); NOT TESTED = exige
browser com sessão; BLOCKED = exige escrita irreversível ou tooling ausente.
Nenhum fluxo com escrita foi executado no PROD.

| ID | Caso | Resultado | Evidência |
|---|---|---|---|
| F01 | PROD carrega (root) | PASS | `GET /` → landing "Vale Transporte CAPS" + "Entrar no sistema" |
| F02 | HTTPS/assets/sem erro visual evidente | PASS | `vercel.app` HTTPS; markdown com módulos/segurança/fluxo; sem JS fatal observável via fetch (console JS completo exige browser) |
| F03 | `/login` carrega | PASS | `GET /login` → "Entrar na sua conta", campos e-mail/senha, "Voltar para a página inicial" |
| F04 | Login gestor | NOT TESTED | sem credenciais/sessão nesta execução; desenho PASS (§3) |
| F05 | Login autorizador | NOT TESTED | idem |
| F06 | Login recepcionista | NOT TESTED | idem |
| F07 | Logout / novo login | NOT TESTED | idem (`logout()` em `app/actions/auth.ts:81-85` não exercitado) |
| F08 | Pacientes: carrega/busca/origem/regular/esporádico/abre paciente | NOT TESTED (browser) / PASS (estático) | `pacientes-view.tsx:121-386` (busca `?q`, badge esporádico, tabela desktop + cards mobile); dados reais não tocados |
| F09 | Liberações: PatientSearch sem paciente | PASS (estático) | `liberacoes-view.tsx:195-214` + `patient-search.tsx:61-212` |
| F10 | Liberações: "Nova liberação" desabilitada sem paciente + motivo | PASS (estático) | `liberacoes-view.tsx:133-146,224-232,269-279` |
| F11 | Liberações: seleção/Trocar paciente | PASS (estático) | `liberacoes-view.tsx:148-176,260-266` |
| F12 | Liberações: status/vigência/previsto/diária/NULL | PASS (estático) | `liberacao-card.tsx:50-83`, `liberacao-status.tsx:8-24`, `liberacao-form.tsx:511-513`, `atendimento-view.tsx:36-40` ("Quantidade diária não informada") |
| F13 | Liberações: "Registrar retirada" → Atendimento com paciente | PASS (estático) | `liberacao-card.tsx:96-103` → `atendimento/page.tsx:34-45` + `atendimento-view.tsx:56-64` |
| F14 | Criar/renovar/cancelar liberação no PROD | BLOCKED | escrita permanente sem autorização explícita do operador; NÃO executado por regra |
| F15 | Atendimento stepper/pesquisa/fluxos/qtd | PASS (estático) | `atendimento-view.tsx:29-34,207-231,270-308,101-174` (contínua=`vales_por_dia`, avulsa padrão retirada 2, NULL informa sem assumir) |
| F16 | Registrar retirada no PROD | BLOCKED | escrita irreversível; NÃO executado |
| F17 | Retiradas: carrega/busca/filtros/identificação | NOT TESTED (browser) / PASS (estático) | `retiradas-view.tsx:71-194`, `retirada-form.tsx:42-47,359-370` |
| F18 | Relatórios: abas Consolidado/Liberações/Retiradas/Histórico | PASS (estático) | `TIPOS_RELATORIO` em `lib/domain/relatorios/types.ts:9-15`; sem aba "Auditoria" (rota separada); semântica `glossario.ts:5-12`, `resumo.ts`, `consolidado.ts:100-116` |
| F19 | Histórico (ambas URLs, timeline, ordem, agrupamento, deep link) | PASS (estático) | só `relatorios?tipo=historico`; `HistoricoTimeline relatorios-view.tsx:1927-2060` (ordem desc, chave dia local, deep link `?paciente=`); self-join removido `relatorio-repository.ts:382-391` |
| F20 | Auditoria (gestor; recepcionista negada) | NOT TESTED (browser) / PASS (estático) | guards §4; modal sem JSON bruto/CPF (§4) |
| F21 | Bloqueios 1-7 (Fase 11) | PASS (estático) | UI+action+RLS (§4); avulsa só via Atendimento (`liberacao-form.tsx:159,546`); esporádico/contínua RN29; contínua ativa bloqueia nova |
| F22 | Responsividade desktop 1440 / mobile 390 | PASS (estático) / NOT TESTED (browser medido) | empilhamento 1col, `hidden md:block` + `md:hidden` cards, `overflow-x-auto` intencional, modais `max-h-[92vh]` (§7) |
| F23 | Console/hidratação/requests/RLS (Fase 13) | PASS parcial | fetch sem erro fatal; `error.tsx`+`loading.tsx` por rota; `AppErrorCode` + `mapSupabaseError` (`app-error.ts`); sem `suppressHydrationWarning`; console JS completo exige browser |

## 6. Fluxos críticos

Nenhum executado com escrita no PROD (todos BLOCKED/NOT TESTED no browser);
desenho validado estaticamente + cobertura DEV herdada (Sprint 87, 815 testes):

- Regular + contínua (F01 DEV PASS): bloqueio de 2ª contínua ativa confirmado
  (`liberacoes-view.tsx:117-119,133,144-145,306-311`; `liberacao-form.tsx:174-182,506-525`).
- Regular + avulsa (F02 DEV PASS): avulsa só via Atendimento; padrão retirada 2
  (`atendimento-view.tsx:71-77,115-120`).
- Esporádico + avulsa + retirada (F03 DEV PASS): cadastro esporádico no Atendimento
  (`atendimento-view.tsx:279-308`); esporádico só-avulsa RN29 (`liberacao-form.tsx:537-551`).
- Esporádico + contínua → bloqueado (F04): trigger RN29 + UI + form.
- Recepção + nova contínua → bloqueado (F05): 3 camadas (§4).
- Contínua + retirada usa `vales_por_dia` (F06): `atendimento-view.tsx:101-114,387-391,445`;
  NULL informa + sugere 2 operacional sem assumir banco (`:39,446`).
- Retirada acima da previsão permitida (F07 DEV PASS): trigger confirmado em PROD (SQL Sprint 86).
- Vigência/fora da vigência bloqueado (F08): RN13-RN21 + trigger em PROD (SQL Sprint 86).
- Histórico (F09) e relatórios (F10): §5 F18/F19.

## 7. Responsividade

Browser medido (1440px/390px) NOT TESTED (sem Playwright/Puppeteer nesta sessão).
Evidência estática PASS (padrão consistente, sem tabela estourada no mobile):

- Container `max-w-7xl px-4 sm:px-6 lg:px-8` (`visual-tokens.ts:10-11`).
- Liberações: `flex-col md:flex-row`, `min-w-0 flex-1`, `truncate`, `grid-cols-1 md:grid-cols-3`,
  `flex-wrap`, botões `flex-col sm:flex-row` (`liberacoes-view.tsx`, `liberacao-card.tsx:48-86`).
- Atendimento: stepper `overflow-x-auto` + `truncate` (`atendimento-view.tsx:207-231`);
  forms `grid-cols-1 sm:grid-cols-2`, ações `flex-col sm:flex-row`.
- Retiradas/Pacientes/Relatórios: tabelas `hidden md:block overflow-x-auto` + cards
  `md:hidden` (`retiradas-view.tsx:104,151`; `pacientes-view.tsx:237,322`; `relatorios-view.tsx`
  tabelas/abas com `overflow-x-auto`).
- Modais: `fixed inset-0 items-end sm:items-center`, `max-h-[92vh] overflow-y-auto`
  (`liberacao-form.tsx:331-338`, `retirada-form.tsx:363-370`).
- Procurar em browser real quando houver tooling: overflow horizontal, botões cortados,
  PatientSearch e Stepper em 390px.

## 8. Erros encontrados

- Funcionais críticos nesta sessão: NENHUM (fetch de `/` e `/login` OK; estático sem
  divergência de desenho; nenhum dado tocado).
- Warnings cosméticos: não avaliados via console JS (exige browser); regra do sprint:
  favicon/warning/extensão NÃO são falha.
- Conhecidos herdados (não retestados, sem suavização):
  - REST anônimo 401 / code 42501 nas tabelas (causa provável: grants do role anônimo;
    mapeado Sprint 84.2/87; confirmação no Dashboard pendente) — P2.
  - Divergência textual menor: card usa "Não informada" (`liberacao-card.tsx:76-83`)
    vs. canônico "Quantidade diária não informada" (`atendimento-view.tsx:36-40`,
    `liberacao-form.tsx:511-513`) e "Diária não informada" (`retirada-form.tsx:622-631`) — P3 cosmético.
  - Nomes esperados no spec (`data_nascimento`, `autorizado_por_id`) divergem do modelo
    real — P3 docs.
- `error.tsx`/`loading.tsx` presentes por rota (atendimento, liberações, retiradas,
  relatórios, pacientes, usuários, auditoria, dashboard); erros mapeados por
  `AppErrorCode` + `mapSupabaseError` (42501→ACESSO_NEGADO, 23505/23503/23514/P0001→VALIDACAO);
  sem `if status===401/403/...` literal no app; 404 funcional tratado no histórico
  (`relatorios-view.tsx:451-483`); hidratação sem `suppressHydrationWarning`, mitigada
  por formatação determinística.

## 9. Evidências

- `GET https://vale-transporte-caps.vercel.app/` → landing institucional (módulos,
  segurança, fluxo 1-4, "Entrar no sistema").
- `GET https://vale-transporte-caps.vercel.app/login` → "Entrar na sua conta" (e-mail/senha).
- Git: `main`, `950e597`, `git status --short` vazio, 16 à frente de `origin/main`.
- Disco: `app/dashboard/{atendimento,auditoria,liberacoes,pacientes,relatorios,retiradas,usuarios}/`
  (sem pasta `historico`); `.vercel/project.json` (org/project); `proxy.ts`; `lib/domain/regras.ts`;
  `app/actions/*`; `supabase/migrations/20260904000001_*` (RLS recepção) e `20260811000009_*` (RLS auditoria).
- Testes DEV (referência Sprint 87): `liberacoes.integration`, `retiradas.integration`,
  `relatorios-historico`, `relatorio-repository`, `sprint47`, RLS Sprint 76, `navegacao.test`,
  `auditoria-labels/view`.

## 10. Testes não executados

| Teste | Motivo exato |
|---|---|
| Login/logout por perfil (gestor/autorizador/recepcionista) | sem credenciais reais nesta sessão; sem browser com sessão; proibido criar usuários/senhas |
| Navegação autenticada em todas as telas | idem (exige sessão) |
| Buscas/filtros com dados reais no browser | exige sessão; PII não pode ir ao relatório |
| Criar liberação/retirada/paciente no PROD | escrita permanente sem autorização explícita do operador; regra 15: NÃO executar, classificar BLOCKED |
| Renovar/cancelar/excluir dados reais | idem; proibido alterar/apagar histórico |
| Medição 1440px/390px + console JS completo | sem Playwright/Puppeteer nesta sessão |
| Contagens PROD atualizadas via SQL/REST | proibido executar SQL no PROD neste sprint; service_role não tocado |
| Vercel deploy/envs, Supabase backup/PITR/restore | sem token/sessão Dashboard; sem contorno tentado |

## 11. Riscos restantes

- **Backup externo NÃO validado; restauração NÃO testada** (deliberadamente pulado antes
  deste sprint). NÃO declarar validado. Risco operacional P0 pendente — sem recuperação
  comprovada não há GO.
- Vercel Production (projeto/deploy/commit/envs) não confirmado por leitura (P1).
- Smoke de browser autenticado + responsividade medida não executados (P1).
- RLS/triggers/RN29/RN31 dependem da auditoria SQL manual Sprint 86; revalidar após
  qualquer migration futura (P0-2).
- REST anônimo 401/42501 pendente de confirmação no Dashboard (P2).
- `supabase` CLI / `psql` ausentes no ambiente local (P2).
- 16 commits locais à frente de `origin/main` (inclui este relatório se commitado);
  push não executado neste sprint.

## 12. Veredito

**NO-GO**

Justificativa evidencial (sem suavização): PROD carrega e desenho estático de
auth/autorização/fluxos/bloqueios/responsividade está coerente, mas (a) login por perfil
no browser NOT TESTED, (b) escritas críticas BLOCKED por segurança, (c) Vercel Production
não confirmada, e sobretudo (d) backup/restauração seguem NÃO validados (P0 explícito
deste sprint). "Não verificado" não é "OK". Próxima etapa: operador com credenciais
executa F04-F08/F14-F20 no browser, leitura manual no Dashboard Vercel/Supabase
confirma deploy + backup/PITR, e revalidação SQL pós-qualquer mudança; só então reavaliar o gate.
