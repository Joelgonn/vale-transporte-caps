# Changelog

> Histórico de entregas por sprint. Consulte `docs/ROADMAP.md` para as fases futuras.

## Sprint 38 — Cadastro de pacientes por origem (RN29)

# SPRINT 38 — CADASTRO DE PACIENTES POR ORIGEM

## 1. Escopo
Fecha a decisão institucional pendente "quem pode cadastrar pacientes":
- **Gestor** e **Profissional Autorizador** cadastram pacientes **regulares**;
- **Recepcionista** cadastra pacientes **esporádicos**, exclusivamente para
  atendimento pontual (liberação avulsa).

## 2. Banco (migration incremental `20260821000001_pacientes_origem.sql`)
- Novo enum `public.origem_paciente` (`regular`, `esporadico`);
- Coluna `public.pacientes.origem` (`NOT NULL DEFAULT 'regular'`) — pacientes
  existentes tornam-se `regular` (nenhum dado alterado);
- `v_pacientes` e `pacientes_com_cpf()` recriadas incluindo `origem`;
- RLS de INSERT substituída:
  - `pacientes_insert_regular` — gestor/autorizador ativos, `origem = 'regular'`;
  - `pacientes_insert_recepcao_esporadico` — recepcionista ativa,
    `origem = 'esporadico'`;
  - (a antiga `pacientes_insert_autorizador` é removida);
- **RN29 no banco**: `fn_liberacoes_before` rejeita liberação não-avulsa para
  paciente esporádico (RN01/RN02/RN27/RN23 e cálculo RN13/RN21 preservados).

## 3. Aplicação
- `lib/domain/enums.ts`: `ORIGENS_PACIENTE` + `ROTULO_ORIGEM_PACIENTE`;
- types de paciente com `origem`; `NovoPaciente.origem` resolvido no servidor;
- `regras.ts`: `validarLiberacao({ origemPaciente })` (RN29),
  `origemPermitidaPorPerfil()`, `permissoesPacientes` com `podeCriarRegular`
  e `podeCriarEsporadico` (sem permissão genérica);
- `criarPacienteAction`: origem derivada do perfil da SESSÃO; origem indevida
  enviada pelo cliente → ACESSO_NEGADO;
- `criarLiberacaoAction`: lê a origem do paciente e repassa à validação RN29;
- UI Pacientes: gestor/autorizador → botão **"Novo paciente"**; recepcionista →
  **"Paciente Esporádico"**; selo de origem na listagem;
- UI Liberações: Contínua desabilitada/forçada para Avulsa quando o paciente é
  esporádico (espelho da regra do banco, que continua sendo a autoridade);
- Auditoria: rótulo/formato do campo `origem`.

## 4. Testes
Domínio (permissões por perfil × origem, RN29 em validarLiberacao,
origemPermitidaPorPerfil), actions de pacientes (✓ gestor/autorizador criam
regular; ✓ recepcionista cria esporadico; ✗ recepcionista/gestor/autorizador
com origem indevida), service/repository de pacientes e liberações,
componentes (PacientesView/PacienteForm/LiberacaoForm/navegação/dashboard) e
integração real env-guarded (`origemAplicada()` pula os cenários até a
migration ser aplicada no remoto).

## Sprint 37 — Estabilização do Auth nos testes (Fase A) + Relatórios (Fase B)

# SPRINT 37 — ESTABILIZAÇÃO DO AUTH NOS TESTES + RELATÓRIOS FASE 8

## 1. Escopo
Sprint em **duas fases**:
- **Fase A** — eliminar o rate limit (429) do Supabase Auth nos testes de
  integração (categoria C recorrente desde a Sprint 20) sem mascarar falhas.
- **Fase B** — retomar o ROADMAP: **Relatórios (Fase 8)**, confirmado como o
  próximo item funcional, com a primeira camada (consulta → filtros →
  resultados → paginação → loading/empty/error), **sem** exportação PDF/Excel.
Identidade visual das Sprints 29–35 **congelada** (mudanças só onde exigido
para integrar a funcionalidade nova). Sem alterações de Auth/RLS/banco.

## 2. Baseline (Fase A)
- 490 testes (467 passando / 23 falhas, todas `AuthApiError: Request rate limit
  reached` 429 — categoria C); lint exit 0; tsc limpo; build OK.

## 3. Diagnóstico do rate limit
- **59 signIns por execução** (rls 19, liberacoes 11, retiradas 11,
  usuarios-criacao 5, estabilidade 12, supabase.integration 1) — um
  `signInWithPassword()` por `it()`, todos disparados no mesmo burst pelos
  workers paralelos do Vitest → estouro do limite por minuto do Supabase Auth
  (observado ~60/min: as execuções 1 e 2 passaram com 21 signIns no mesmo
  minuto; a 3ª falhou).

## 4. Correção (Fase A)
- `tests/global-setup.ts` — autentica **1 sessão por perfil por execução** (5
  signIns **sequenciais**) e grava em `%TEMP%\vale-transporte-caps-auth-sessions.json`.
- `tests/helpers/supabase-clients.ts` — `autenticar()` com retry/backoff
  **somente** para HTTP 429; `clientesPorPerfil()` sequencial; clients
  reconstruídos via `auth.setSession()` (local, sem rede) a partir da sessão
  compartilhada; fallback para sign-in real se o arquivo não existir (execução
  parcial); contador opcional `TEST_AUTH_DEBUG=1`.
- `vitest.config.mts` — `globalSetup: ["./tests/global-setup.ts"]`.
- 5 arquivos de integração refatorados para sessão única por perfil
  (`beforeAll`); `tests/supabase.integration.test.ts` (login inválido) tolera
  429 com retry, mantendo a intenção (espera 400).
- **Testes de concorrência preservados REAIS** (`Promise.allSettled` com
  INSERTs paralelos — Sprint 36): nenhuma serialização artificial.
- Verificado com `TEST_AUTH_DEBUG=1`: **zero signIns nos workers**; integração
  real segue verde.

## 5. Aceite Fase A
- **3 execuções consecutivas `npm test` → 490/490, 490/490, 490/490** (EXIT=0),
  zero falhas 429.

## 6. Fase B — Relatórios (Fase 8 do ROADMAP)
ROADMAP lido e **confirmado**: o próximo item funcional é **Relatórios**
("relatórios seguem sem tela no app"; "Sugestão — Sprint 25" item 3; Fase 8
"Relatórios com filtros (período, usuário, paciente, tipo, quantidade,
retiradas); Consolidações; exportação PDF/Excel/CSV somente planejada").

### 6.1 Escopo entregue
- **Rota `/dashboard/relatorios`** — exclusiva do **Gestor ativo**
  (`permissoesRelatorios` em `lib/domain/regras.ts`; page + action com gate;
  REPORTS.md/SECURITY.md). **Acesso de autorizador = DECISÃO INSTITUCIONAL
  PENDENTE** — não implementado.
- **3 consultas**:
  - **Liberações** — filtros período (data_inicio), tipo e busca por paciente
    (nome/Gestor SUS via `v_pacientes`, sem CPF); colunas: paciente, tipo,
    quantidade, período (descrito por tipo — RN13/RN21), status, autorizador,
    **total retirado** (Σ embeds).
  - **Retiradas** — filtros período (data_hora) e busca; colunas: data/hora,
    paciente, liberação, quantidade, recepcionista.
  - **Consolidado** — por liberação: **autorizado vs. entregue**, com **saldo
    derivado no servidor** (quantidade − Σ retiradas); saldo negativo destacado.
- Filtros e paginação **no servidor** (PostgREST `eq`/`gte`/`lte` + `range` +
  `count: exact`; `de`/`ate` de input date; `ate` → fim do dia UTC); embeds com
  alias de FK (`autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey`,
  `recepcionista:usuarios!retiradas_recepcionista_id_fkey`).
- Arquitetura: `lib/domain/relatorios/{types,mapeamento,rotulos}.ts` (funções
  **puras** testáveis) → `lib/repositories/relatorio-repository.ts` →
  `lib/services/relatorio-service.ts` → `app/actions/relatorios.ts`
  (`exigirUsuarioAtivo()` + gate de Gestor, mensagens seguras) →
  `app/dashboard/relatorios/{page,loading,error}.tsx` +
  `components/relatorios-view.tsx` (seletor de tipo preservando filtros, tabela
  desktop + cards mobile, contador, paginação preservando filtros, empty/error).
- Navegação integrada (mínimo necessário): `navegacao.ts`
  (`relatorios` em `CapacidadeDashboard`/`IconeId`/`modulosPorCapacidade`/
  `acoesRapidasPorPerfil`), `icones.tsx` (ícone de relatório), regras
  (`capacidadeDashboard.relatorios`) — sidebar/breadcrumb/home/ações rápidas
  automáticas.
- **Sem migration** (somente SELECTs via RLS existente — nenhuma policy nova);
  **sem CPF** nos relatórios; sem exportação; `globals.css` intocado.

## 7. Testes (Fase B)
- **59 testes novos** (490 → **549**): domínio (`relatorios-labels`:
  mapeamento/soma/embed to-one/to-many/saldo e rótulos/formatação/datas),
  `relatorio-service` (tipo/página válidos, delegação ao repositório),
  `relatorio-repository` (mock PostgREST: embeds sem CPF, gte/lte/eq/in,
  `ate`→fim do dia, busca sem correspondência, saldo negativo), `actions`
  (gate de Gestor/inativo/sem vínculo, erros seguros sem SQL), componente
  (abas preservando filtros, tabelas dos 3 tipos, empty contextual, erro,
  paginação), `regras` (`permissoesRelatorios` por perfil) e **integração real
  12/12** (`tests/integration/relatorios.integration.test.ts` — consultas
  PostgREST exatas do repositório por perfil: Gestor lê tudo sem CPF; autorizador
  lê liberações mas **não vê o nome do autorizador** nem retiradas; recepção sem
  usuarios; inativo/sem vínculo/anon 0 linhas). Testes de navegação/dashboard
  atualizados para o novo módulo (Gestor vê; recepção/autorizador não).

## 8. Validação
- lint exit 0; `tsc --noEmit` limpo; `next build` OK (13 rotas + Proxy, incluindo
  `/dashboard/relatorios`).
- **3 execuções consecutivas `npm test` → 549/549, 549/549, 549/549** (EXIT=0;
  zero 429 — Fase A mantida). Integração de relatórios isolada 12/12.
- Secret scan limpo; `git status`/`git diff` revisados; nenhum segredo/CPF
  adicionado.

## 9. Pendências registradas (não desta sprint)
- Relatórios para **autorizadores** — DECISÃO INSTITUCIONAL PENDENTE.
- Relatório de **Renovações**, histórico por paciente e **exportação**
  PDF/Excel/CSV — planejados (ROADMAP Fase 8).
- Auditoria de login — DECISÃO INSTITUCIONAL PENDENTE (Sprint 36).

## Sprint 36 — Estabilização Banco/RLS/Auth (P1/P2)

# SPRINT 36 — ESTABILIZAÇÃO BANCO/RLS/AUTH

## 1. Escopo
Sprint de **estabilização** dos gaps P1/P2 de Banco/RLS/Auth identificados nas
Sprints anteriores. **Nenhuma alteração de UI/UX** (identidade congelada das
Sprints 29–35), nenhuma regra de negócio inventada, migrations **somente após
reprodução real** no banco e nenhuma execução remota sem autorização explícita.
Server Action ≠ autoridade: as regras sensíveis foram reforçadas no BANCO.

## 2. Baseline
- 481 testes (467 passando / 14 falhas, todas `AuthApiError: Request rate limit
  reached` 429 — categoria C); lint exit 0; tsc limpo; build OK (12 páginas +
  Proxy).

## 3. Gaps investigados
1. **Race condition no saldo de retiradas** — `fn_retiradas_before` lia a
   liberação **sem** `FOR UPDATE` e calculava o saldo com `SUM` separado
   (TOCTOU). **Reproduzido** (`scripts/repro-sprint-36.mjs` — Parte A):
   liberação de 2 com 4 retiradas concorrentes de 1 → 4/4 aceitas e soma=3 > 2.
2. **Renovação forjável via PostgREST** — a RLS já bloqueava "quem renova"
   (migration 20260813000002), mas `fn_liberacoes_before` não validava o vínculo
   da renovação com a liberação original. **Reproduzido** (Parte B): renovação
   com paciente **diferente** foi aceita pelo banco.
3. **Auditoria de login** — **investigação apenas** (não implementar): não
   existe log de login em nenhuma camada (action não grava; sem trigger em
   `auth.users`; `auditoria_logs.usuario_id NOT NULL` impede log de falha sem
   sessão; sem INSERT grant para authenticated). → **DECISÃO INSTITUCIONAL
   PENDENTE** registrada.
4. **Matriz de transições de status de liberações** — o estado atual já é
   seguro por construção: sem policy de UPDATE e `revoke update` (migration 15);
   nenhuma transição é possível via PostgREST. Coberto por testes negativos.

## 4. Migrations criadas e aplicadas (manual — SQL Editor)
1. `supabase/migrations/20260817000001_retiradas_lock_liberacao.sql` —
   `SELECT ... FOR UPDATE` na liberação dentro de `fn_retiradas_before`
   (serializa retiradas por liberação).
2. `supabase/migrations/20260817000002_liberacoes_renovacao_mesmo_paciente.sql`
   — RN23 no `fn_liberacoes_before`: renovação deve referenciar liberação do
   **mesmo paciente** (DATABASE.md, constraint 12).

## 5. Validação das funções no banco real (comportamental)
- `fn_retiradas_before`: 4 retiradas concorrentes de 1 em liberação de 2 → 2
  aceitas, 2 recusadas, soma=2 → **sem over-subscription** (o lock serializa).
- `fn_liberacoes_before`: renovação do mesmo paciente → permitida; de outro
  paciente → bloqueada com "Renovação deve referenciar a liberação anterior do
  mesmo paciente (RN23)".

## 6. Testes de estabilidade — 9/9 (`tests/integration/estabilidade.integration.test.ts`)
- Concorrência (migration 01): soma ≤ quantidade autorizada e ≤ 2 sucessos.
- RN23 (migration 02): recepção NÃO renova com paciente diferente (bloqueado no
  banco + `AppError` `VALIDACAO` no fluxo do serviço).
- Matriz de transições: gestor/autorizador/recepcionista/inativo/sem vínculo NÃO
  alteram status de liberações (UPDATE negado).
- PostgREST direto: autorizador NÃO renova; recepção NÃO cria liberação nova.

## 7. Matriz de perfis em renovação (PostgREST direto — `scripts/validate-sprint-36.mjs`)
| Perfil | Resultado | Esperado |
|---|---|---|
| RECEPCIONISTA ativa | PERMITIDA | permitida ✓ |
| AUTORIZADOR ativo | BLOQUEADA | bloqueada ✓ |
| GESTOR ativo | BLOQUEADA | bloqueada ✓ |
| INATIVO | BLOQUEADA | bloqueada ✓ |
| SEM VÍNCULO | BLOQUEADA | bloqueada ✓ |
| ANON | BLOQUEADA | bloqueada ✓ |

## 8. Testes gerais
- `npm test`: **490 testes** (447 passando / 43 falhas — **todas**
  `AuthApiError: Request rate limit reached` 429 do Supabase Auth, **categoria
  C**/ambiental, baseline flutuante 13–43 conforme volume de sign-ins; **zero
  falha de aplicação**). Estabilidade **9/9 verde isoladamente** (o 429 no run
  completo é artefato do volume de sign-ins em lote).
- Integrações isoladas: estabilidade 9/9; retiradas/liberações/RLS com falhas
  exclusivamente 429; `supabase.integration` 100%.

## 9. Lint / TSC / Build / Secret scan
- `npm run lint` OK (exit 0, 0 erros, 0 warnings).
- `npx tsc --noEmit` limpo.
- `npm run build` OK (12 páginas + Proxy).
- Secret scan limpo (nenhuma chave/JWT/token/segredo; apenas placeholders).

## 10. Git
Estado igual ao baseline acumulado (6 modificados + 13 novos das Sprints
29–34) + arquivos da Sprint 36 (2 migrations, 2 scripts de validação, 1 teste
de integração novo, edições em `lib/domain/app-error.ts` e
`tests/integration/rls.integration.test.ts`). Nada fora do escopo. Repositório
segue **sem commit** (padrão das Sprints anteriores).

## 11. Pendências mantidas
- **Auditoria de login** (`auth.login_sucesso`/`auth.login_falha` — `AUDIT.md`):
  não implementada → **DECISÃO INSTITUCIONAL PENDENTE** (mecanismo, retenção,
  tratamento de falha sem sessão, impacto do rate limit 429).
- Validação visual **humana em navegador real** (legada).
- P3 auditoria: diálogo sem trap de Tab; P3 tabela de usuários com rolagem
  horizontal no mobile (legadas).
- Cancelamento/transição `cancelada` de liberações: sem fluxo definido
  (DECISÃO PENDENTE — estado atual bloqueia toda UPDATE, seguro por construção).

## 12. Riscos
- Rate limit do Supabase Auth (429) impacta a execução em lote dos testes de
  integração (categoria C); sem efeito no comportamento do banco validado
  isoladamente.
- Migrations aplicadas manualmente via SQL Editor (sem histórico no
  `schema_migrations` do CLI): futuros `supabase db push` podem tentar
  reaplicá-las — as duas usam `create or replace function` (idempotente).
- `FOR UPDATE` no `fn_retiradas_before` não introduz deadlock: nenhuma outra
  operação trava linhas de `liberacoes` (UPDATE/DELETE revogados).

## 13. Veredito
**APROVADA** — os dois gaps P1/P2 de banco foram reproduzidos, corrigidos com
migrations aditivas mínimas e validados no banco real (race: serialização via
`FOR UPDATE`, sem over-subscription; RN23: renovação do mesmo paciente
permitida e de outro bloqueada; matriz de perfis 6/6 conforme; PostgREST direto
comprova segurança no banco). Auditoria de login registrada como decisão
institucional pendente. Zero regressão de aplicação; falhas restantes
exclusivamente Auth 429 (categoria C).

## Sprint 35 — Validação visual e refinamento final (visual-only)

# SPRINT 35 — VALIDAÇÃO VISUAL E REFINAMENTO FINAL

## 1. Escopo
Sprint de **validação**, não de redesenho: a identidade visual das Sprints
29–34 é a referência. Nenhuma nova linguagem, nenhum efeito por preferência
pessoal. Auditadas todas as páginas (Landing, Login, Primeiro acesso,
Dashboard, Pacientes, Liberações, Retiradas, Usuários, Auditoria) por código,
contrato e renderização; corrigidos **somente** os problemas provados.

## 2. Problemas encontrados e correções
1. **P2 — inconsistência de título em card mobile (Retiradas):** o nome do
   paciente no card mobile usava `text-zinc-900`, enquanto todos os demais
   títulos de card (Pacientes/Liberações/Auditoria) usam o azul institucional
   `text-brand-900`. Corrigido para `brand-900` — consistência de superfície
   (visual-only).
2. **P1 — contraste do estado da conta na sidebar:** o texto do status
   ("Ativo"/"Inativo"/"Sem perfil funcional") usava `text-zinc-400` a 12px
   (contraste ≈2,9:1, abaixo do AA 4,5:1 — parecia "lavado"/desabilitado sem
   estar). Elevado para `text-zinc-500` (≈4,6:1, passa AA).
3. **P2 — seletor de Perfil/Profissão sem indicação de dropdown:** os dois
   únicos `<select>` com `appearance-none` e **sem** chevron customizado
   (Perfil e Profissão do "Novo usuário") perdiam a seta nativa do dropdown —
   inconsistentes com os outros 6 selects do sistema e sem affordance de
   seleção. `appearance-none` removido (visual-only, sem mudança de
   comportamento).

## 3. Auditado sem alteração
- **Cores/função:** verde somente em ação principal/sucesso (CTA, botões
  primários/positivos, badges de sucesso, stepper concluído) e na hairline de
  identidade do header; accent (turquesa) em links/destaques/indicador ativo;
  brand em identidade/estrutura; neutros em superfícies secundárias.
- **Tipografia:** hierarquia H1/H2/títulos de seção/cards/descrições/labels/
  badges/mensagens consistente; nenhum outro texto "lavado" sem estar disabled.
- **Card-glow:** arquitetura preservada (estilo via `style.setProperty`, zero
  estado por movimento); `motion-reduce` e ausência no touch confirmadas.
- **Microinterações:** movimento 1–4px, 150–250ms, `ease-out`, `motion-reduce`
  em todas as interações; hover de linha de tabela sutil; nada de hover onde não
  há ação.
- **Mobile/Responsividade:** 360/390/430/768/1024/1280/1440 contemplados;
  drawer e cards sem dependência de hover; sem overflow horizontal indevido
  (tabelas mantêm rolagem contida).
- **Acessibilidade:** `aria-current`, `role=alert/status`, foco visível,
  `useModalA11y` intactos e **não** reescritos.
- **Renovação ≠ criação:** modal de renovação mantém o painel de origem, badge
  âmbar "Renovação" e botão "Renovar" — distinção preservada.
- **Saldo:** permanece informativo (RN22), sem gamificação.

## 4. Arquivos alterados
- `app/dashboard/retiradas/components/retiradas-view.tsx` (título do card);
- `components/dashboard/dashboard-shell.tsx` (contraste do status);
- `app/dashboard/usuarios/components/novo-usuario-form.tsx` (affordance dos
  selects);
- `docs/CHANGELOG.md`.

## 5. Testes
- Componentes/domínio/actions/repositórios/serviços (não-auth): **440/440
  passando** (39 arquivos) — nenhum teste alterado.
- Suíte completa: **481 testes**; falhas exclusivamente `AuthApiError: Request
  rate limit reached` (429 do Supabase Auth) — **categoria C/ambiental**, mesmo
  baseline das Sprints 30–34 (flutua 13–27 entre execuções). Nenhuma regressão
  de aplicação.

## 6. Lint / TSC / Build / Secret scan
- `npm run lint` OK (exit 0).
- `npx tsc --noEmit` limpo.
- `npm run build` OK (12 páginas + Proxy).
- Secret scan limpo (nenhuma chave/JWT/token/segredo).

## 7. Git
`git status` igual ao baseline: apenas os arquivos acumulados das Sprints
29–34 (6 modificados + 13 novos) e os 3 arquivos de correção desta sprint.
Nenhum arquivo inesperado.

## 8. Pendências mantidas
- Validação visual **humana em navegador real** (1280/1440/360/390/430) —
  o ambiente de execução é headless; as correções foram validadas por código/
  contraste/testes/build.
- P3 auditoria: diálogo de detalhes sem trap de Tab.
- P3 tabela de usuários com rolagem horizontal no mobile (sem cards mobile).
- P1–P2 de banco/Auth/docs das Sprints anteriores (fora do escopo visual).

## 9. Veredito
**APROVADA COM PENDÊNCIAS** — interface coesa e consistente (uma única
linguagem, papéis de cor respeitados, tipografia e microinterações uniformes);
3 problemas reais corrigidos (contraste P1, consistência P2 e affordance P2),
zero redesenho, zero regressão, contratos intactos; única pendência material é
a validação visual humana em navegador real.

## Sprint 34 — Propagação das microinterações premium (visual-only)

# SPRINT 34 — PROPAGAÇÃO DAS MICROINTERAÇÕES PREMIUM

## 1. Baseline
Sprint 33 (referência aprovada): `card-glow.tsx`, `MOTION_FAST/STANDARD/PREMIUM`,
`CARTAO_INTERATIVO`, `ACAO_PRINCIPAL`, `NAV_LINK_ATIVO`. Sprint 34 apenas
**expande** esse sistema às páginas operacionais — sem redesenho, sem segunda
linguagem de animação, sem alterar domínio/regras/Auth/banco/RLS.

## 2. Padrão Sprint 33 reutilizado
- Movimento 1–4px + opacity/transform/superfície, 150–250ms, `ease-out`.
- `motion-reduce` em toda interação nova (transforms removidos, superfície mantida).
- Glow seguindo cursor **somente onde há profundidade de card** (Sprint 33);
  nada de glow em tabelas, inputs, textos ou áreas densas.
- Tokens centralizados; classes novas só quando repetidas em 3+ lugares.

## 3. Pacientes
- Tabela (desktop): **hover de linha muito sutil** (`hover:bg-brand-50/40`, sem
  transform) — leitura preservada; foco via `focus-visible`.
- Botões Inativar/Reativar (tabela e cards mobile) unificados nos novos tokens
  **`BOTAO_AVISO`** (âmbar) e **`BOTAO_POSITIVO`** (verde) — hover, active via
  `:active` implícito, `focus-visible` e `disabled` coerentes. Ação de negócio:
  sem efeito chamativo, sem sugerir sucesso antes do servidor.
- Botão "Editar" ganhou `focus-visible` e duração padrão.
- Formulário (PacienteForm): inputs com `INPUT`/`INPUT_ERRO` (foco elegante),
  botões `BOTAO_PRIMARIO`/`BOTAO_SECUNDARIO` — já premium.

## 4. Liberações
- Tabela: hover de linha sutil.
- Botão "Renovar" (tabela e mobile) unificado em `BOTAO_AVISO` (âmbar, destaque
  de renovação) com `focus-visible` e `disabled`.
- CTA de renovação no formulário usa `BOTAO_PRIMARIO` (verde) — padrão
  `ACAO_PRINCIPAL` para a confirmação da ação dominante.
- Stepper: etapas não são navegáveis por clique → **nenhum** hover inventado
  (só se aplica a "etapa navegável").

## 5. Retiradas
- Tabela: hover de linha sutil.
- Seleção de paciente/liberação já possui hover/estado selecionado coerentes
  (revisado, mantido).
- **Saldo NÃO é animado como número de jogo**: permanece informação orientativa;
  a autoridade continua sendo o banco. Nenhum contador/gamificação adicionado.

## 6. Usuários
- Tabela: hover de linha sutil.
- Ativar/Inativar unificados em `BOTAO_AVISO`/`BOTAO_POSITIVO` — mudança de
  superfície + `disabled` ("Salvando...") enquanto a transição roda; feedback de
  sucesso vem do servidor, nunca de animação.
- "Novo usuário" usa `BOTAO_PRIMARIO`; formulário com tokens padrão.

## 7. Auditoria
- Tabela: hover de linha sutil (área densa — contraste/intensidade mínimos).
- **Links "Detalhes"/"Ver detalhes"** viraram o padrão de link interativo:
  seta "→" que desloca 2px no hover + mudança de tonalidade (accent), com
  `motion-reduce`.
- Filtros (selects/data): foco elegante com `transition-colors` +
  `focus:ring-brand-600/20`; botão "Filtrar" e paginação com tokens padrão.
- Detalhe (modal): entrada/saída e foco preservados via `useModalA11y` — **não
  reescrito**; dados "Antes/Depois" permanecem extremamente legíveis, sem animação.

## 8. Login
- Campos com `INPUT` (foco elegante existente); toggle de senha ganhou feedback
  `active` sutil; botão `BOTAO_PRIMARIO` (elevação/hover já premium).
- **Nenhum cursor-following glow** no formulário — apenas microinterações
  apropriadas.

## 9. Primeiro acesso
- Não existem "cards de perfil" nesta jornada (fluxo é apenas troca de senha).
- Campos com `INPUT`/`INPUT_ERRO`, toggle com hover/foco, CTA `BOTAO_PRIMARIO`.
  Estados de sucesso/erro legíveis, sem animação chamativa. Nada inventado.

## 10. Cards
Cards puramente informativos (mobile dos módulos, resumo) **continuam estáticos**
(regra: sem hover onde não há ação). Cards/opções interativos já cobertos pelo
padrão Sprint 33 (módulos, ações rápidas).

## 11. Links
Padrão consistente de link interativo aplicado/confirmado: "Detalhes"→"/Ver
detalhes" (seta desloca + tonalidade), "Limpar" via token `LINK` (underline no
hover), links de módulo/CTAs com seta e deslocamento. Sem underline obrigatório;
seta sempre `aria-hidden`.

## 12. Botões
Taxonomia preservada: PRIMÁRIO verde (`BOTAO_PRIMARIO`), SECUNDÁRIO neutro
(`BOTAO_SECUNDARIO`), GHOST (`BOTAO_GHOST`), PERIGO/aviso (`BOTAO_AVISO`), ação
positiva (`BOTAO_POSITIVO`). Todos com hover, `active`, `focus-visible` e
`disabled` coerentes e centralizados.

## 13. Tabelas
Tabelas **não** viraram cards animados: apenas `hover:bg-brand-50/40` muito
sutil (sem transform), foco visível e ações com microinteração. Leitura em
primeiro lugar.

## 14. Modais
Sem alterações estruturais: entrada/saída, trap de Tab, Escape, restauração de
foco e `aria` preservados. `useModalA11y` **não** foi reescrito.

## 15. Mobile
Nada depende de hover: feedback via `active`/`focus`; cards mobile estáticos;
botões de status com `disabled` ("Salvando..."). 360/390/430 contemplados
(botões com altura de toque h-9/h-11 mantidas).

## 16. Reduced Motion
`prefers-reduced-motion: reduce` respeitado em todas as interações novas:
`motion-reduce:transition-none` + remoção de transforms/deslocamentos; contraste
e superfície mantidos; `disabled`/"Salvando..." intactos.

## 17. Performance
Nenhum listener global, nenhum estado por mousemove novo, nenhuma biblioteca
adicionada. `CardGlow` reutilizado como na Sprint 33 (cliente, via
`style.setProperty`).

## 18. Design System
Criados tokens **`BOTAO_AVISO`** e **`BOTAO_POSITIVO`** (repetidos em 3+ lugares:
Pacientes/Liberações/Usuários) — classes completas, sem conflitos, altura
acrescentada no uso. Padrão de link interativo com seta também centralizado no
uso (Auditoria). Sprint 33 + 34 formam **um único sistema**.

## 19. Arquivos alterados
- `components/ui/visual-tokens.ts` (novos `BOTAO_AVISO`, `BOTAO_POSITIVO`);
- `app/dashboard/pacientes/components/pacientes-view.tsx`;
- `app/dashboard/liberacoes/components/liberacoes-view.tsx`;
- `app/dashboard/retiradas/components/retiradas-view.tsx`;
- `app/dashboard/usuarios/components/usuarios-view.tsx`;
- `app/dashboard/auditoria/components/auditoria-view.tsx`;
- `app/login/login-form.tsx`;
- `docs/CHANGELOG.md`.

## 20. Testes
- Componentes: **169/169 passando** (nenhum teste alterado).
- Suíte completa: **467/14** — falhas **100%** em integrações Supabase
  (`AuthApiError: Request rate limit reached`, 429), **categoria C/ambiental**
  (mesmo baseline das Sprints 30–33; flutua 13–35). Nenhuma falha de UI/componente.

## 21. Lint
`npm run lint` OK (exit 0).

## 22. TSC
`npx tsc --noEmit` limpo.

## 23. Build
`npm run build` OK (12 páginas + Proxy).

## 24. Validação visual
**Pendente.** Ambiente headless sem navegador: não foi possível validar
LANDING/LOGIN/PRIMEIRO ACESSO/DASHBOARD/PACIENTES/LIBERAÇÕES/RETIRADAS/USUÁRIOS/
AUDITORIA em 1280+/1440+/360/390/430 nem testar entrar/mover/sair/clicar/Tab.
Recomendada revisão humana: hover das linhas, setas de "Detalhes", foco dos
filtros e leitura das tabelas.

## 25. Pendências
- Validação visual humana em navegador (item 24).
- Pendências anteriores mantidas (P3 auditoria sem trap, P3 tabela de usuários
  mobile, P1–P2 de banco/Auth/docs).

## 26. Veredito
**APROVADA COM PENDÊNCIAS** — microinterações premium propagadas com consistência
única (tabelas discretas, botões de status centralizados, links interativos com
seta, foco elegante nos filtros, CTAs verdes preservados), mobile e reduced
motion respeitados, performance/a11y/contratos intactos; validação visual humana
em navegador permanece pendente.

## Sprint 33 — Microinterações premium (visual-only)

# SPRINT 33 — MICROINTERAÇÕES PREMIUM

## 1. Direção
Princípio adotado: **"a interação responde ao usuário, não chama atenção para si"**.
Todas as interações usam movimento de 1–4px, opacity, transform e mudança de
superfície, com duração centralizada (150–250ms) e easing `ease-out`. Nada de
bounce, rotação, escala agressiva, partículas ou animações contínuas. O conteúdo
é sempre o protagonista; a resposta é percebida sem ser pensada.

## 2. Textos interativos
- **Sidebar (Dashboard, Pacientes, Liberações, Retiradas, Usuários, Auditoria):**
  no hover, o ícone desloca 2px (`translate-x-0.5`) e o texto muda sutilmente de
  tonalidade (`brand-800`) com fundo `brand-50/70` — resposta discreta, sem
  alterar a hierarquia. Ativo inalterado (Sprint 32).
- **"Abrir" nos módulos e setas dos CTAs:** a seta desloca 2px (módulos) ou 4px
  (CTA verde) e muda de tom (`accent-600`) no hover.
- **Ações rápidas "Renovar liberação", "Consultar auditoria", "Registrar
  retirada", "Gerenciar usuários":** rótulo e descrição estáveis; ícone e seta
  respondem (ver seções 6).

## 3. Cards
Cards interativos (módulos e ações rápidas) ganharam o token **`CARTAO_INTERATIVO`**:
hover `translateY(-2px)` + sombra levemente maior; `active` recolhe (`translateY(0)`
+ profundidade reduzida); `focus-visible` com outline institucional (accent). Cards
puramente informativos (hero band, visão geral, resumo de conta) **não** recebem
hover — nada de efeito onde não há ação.

## 4. Card destaque (módulo Pacientes)
Interação diferenciada, usando os elementos existentes:
- círculo decorativo desloca 8px no hover (`translate-x-2/-translate-y-2`);
- glow branco decorativo cresce sutilmente (`scale-110`);
- ícone sobe 2px;
- conteúdo (título/descrição) permanece estável;
- card sobe discretamente (2px) com sombra levemente maior.
Nada de animação chamativa; tudo volta ao repouso suavemente ao sair.

## 5. Cursor-following
Implementado `CardGlow` (client, `components/ui/card-glow.tsx`): um radial sutil
(~130px, accent nos cards azuis/neutros, branco no CTA verde) que acompanha o
ponteiro dentro do card. **Sem tilt 3D.** Técnica: `aoMoverCursor` atualiza as
variáveis CSS `--glow-x/--glow-y` direto na DOM via `style.setProperty` — **zero
estado React por movimento, zero re-render**. Ao sair, o glow some via opacity
(transição 250ms) e volta ao repouso. Aplicado em: módulo destaque, módulos
neutros, CTA secundário e CTA verde.

## 6. CTAs
- **CTA verde (`ACAO_PRINCIPAL`):** fundo permanece verde, gradiente/glow aumentam
  sutilmente, ícone sobe 2px, seta avança 4px. **Textos intactos:** título branco,
  descrição `white/80`, ícone e seta brancos. Token atualizado com duração 200ms +
  `motion-reduce` (hover sem transform sob reduced motion).
- **CTA secundário (`AcaoRegular`):** elevação suave, borda ganha **accent** no
  hover (`ring-accent-400/60`), ícone muda sutilmente (fundo `accent-50` + texto
  `accent-700`), seta desloca e ganha accent. **Não** vira botão verde — mantém a
  superfície neutra.

## 7. Sidebar
Hover refinado: ícone desloca 2px, texto muda de tom, fundo discreto
(`brand-50/70`). **Ativo mantém exatamente o Sprint 32**: fundo brand, texto
branco, ícone branco, indicador accent — nenhuma alteração. Hover do ativo apenas
aprofunda o gradiente (resposta sutil sem mudar hierarquia).

## 8. Hero
Microinterações discretas no fluxo Identificação → Liberação → Retirada:
- ícone de cada etapa cresce 1–2px no hover (`scale-[1.06]`);
- label ganha destaque (clareia para branco);
- chevron conectivo desloca 2px.
Nada anima permanentemente; tudo depende do hover.

## 9. Mobile
Nenhuma interação depende de hover. No toque valem os feedbacks `active`
(recolhimento do card) e `focus-visible` (teclado). O glow do cursor usa
`group-hover`, que não existe em touch — nenhum efeito inútil no mobile. Cards e
links continuam funcionais por toque.

## 10. Reduced Motion
`prefers-reduced-motion` respeitado em **todas** as interações novas e nos tokens:
- `motion-reduce:transition-none` remove as transições;
- `motion-reduce:hover:translate-y-0`, `group-hover:scale-100` etc. removem as
  transformações;
- `motion-reduce:hidden` remove a camada de glow do cursor;
- mudanças essenciais de superfície/contraste (cor de fundo/texto, ring) são
  **mantidas** para não perder feedback.

## 11. Performance
- Glow localizado no componente, atualizado por `style.setProperty` — sem estado
  React por movimento, sem `requestAnimationFrame` permanente, sem re-render do
  Dashboard.
- `CardGlow` é um único componente pequeno reutilizado (sem abstração desnecessária).
- Nenhuma biblioteca de animação adicionada; tudo com utilitários do Tailwind.

## 12. Acessibilidade
- `aria-hidden` e `pointer-events` preservados; o glow é puramente decorativo.
- Foco visível mantido em todos os cards/links (`focus-visible` outline accent).
- Nenhuma funcionalidade depende de animação: cards funcionam sem hover (mobile),
  sem glow (reduced motion) e com teclado.
- Cliques continuam vazando para os Links (o card inteiro é o alvo).

## 13. Arquivos alterados
- `components/ui/card-glow.tsx` (novo — `CardGlow` + `aoMoverCursor`);
- `components/ui/visual-tokens.ts` (tokens `MOTION_FAST/STANDARD/PREMIUM`,
  `CARTAO_INTERATIVO`; `ACAO_PRINCIPAL` com duração 200ms + motion-reduce);
- `components/dashboard/module-card.tsx` (microinterações destaque + normal);
- `components/dashboard/dashboard-home.tsx` (CTA verde, CTA secundário, hero);
- `components/dashboard/dashboard-shell.tsx` (hover do ícone inativo);
- `docs/CHANGELOG.md`.

## 14. Testes
- Componentes: **169/169 passando** (nenhum teste alterado).
- Suíte completa: **450/31** nesta execução — falhas **100%** `AuthApiError:
  Request rate limit reached` (429 do Supabase Auth), **categoria C/ambiental**
  (mesmo baseline das Sprints 30–32; flutua 13–35 por rate limit). Nenhuma
  regressão de aplicação.

## 15. Lint
`npm run lint` OK (exit 0).

## 16. TSC
`npx tsc --noEmit` limpo.

## 17. Build
`npm run build` OK (12 páginas + Proxy; client component `CardGlow` compilado).

## 18. Validação visual
**Pendente.** Ambiente headless sem navegador: não foi possível validar 1280/1440/
360/390/430 nem observar entrar/mover/sair/clicar/tabular. Recomendada revisão
humana em navegador: suavidade do glow, elevação dos cards, excesso de movimento
(regra de ouro: se a animação for notada antes do conteúdo, está forte demais).

## 19. Pendências
- Validação visual humana em navegador (item 18) — inclui testar o glow com mouse
  (entrar, mover, sair, reentrar) e conferir que o CTA verde manteve textos brancos.
- Pendências anteriores mantidas (P3 auditoria sem trap, P3 tabela de usuários
  mobile, P1–P2 de banco/Auth/docs).

## 20. Veredito
**APROVADA COM PENDÊNCIAS** — microinterações discretas e premium implementadas
(movimento 1–4px, glow que segue o cursor sem tilt, elevação padrão de cards,
hover refinado na sidebar/hero/CTAs), tokens de motion centralizados, CTA verde
com textos brancos intactos, mobile e reduced motion respeitados, performance
preservada, a11y e contratos intactos; validação visual humana em navegador
permanece pendente.

## Sprint 32 — Contraste, estados ativos e hierarquia visual (visual-only)

# SPRINT 32 — CONTRASTE E ESTADOS VISUAIS

## Problemas encontrados
1. **Item ativo do sidebar "cinza/desabilitado" (prioridade máxima).** O token
   `NAV_LINK_ATIVO` era apenas *aditivo* (cor de fundo + `text-white`), somado sobre
   `NAV_LINK` (`text-zinc-600` + `font-medium`). Como `text-zinc-600` e `text-white`
   têm a mesma especificidade, o vencedor é definido pela ordem no CSS compilado — e o
   cinza vencia sobre o fundo brand. Resultado: todos os itens ativos (Dashboard,
   Pacientes, Liberações, Retiradas, Usuários, Auditoria) pareciam desabilitados. O
   mesmo conflito afetava `font-medium`×`font-semibold` e os estados de hover.
2. **Chevrons decorativos quase invisíveis na Landing.** `text-brand-200` (azul muito
   claro) sobre superfícies claras (card branco e seção `zinc-50`) — baixo contraste em
   dois conectores de etapas ("Como funciona" e "Como o benefício flui").
3. Auditoria geral: nenhum outro conflito de utilitários de cor; nenhum texto cinza
   sobre verde; nenhum turquesa como texto sobre fundo inadequado; nenhum
   `white/40–70` excessivo; estados disabled corretamente com `opacity-50`.

## Correções
1. **Tokens de navegação reestruturados** (solução estrutural, não paliativo):
   `NAV_LINK` virou a base flex dos itens **inativos** (`flex items-center gap-3`,
   texto `zinc-600` neutro) e `NAV_LINK_ATIVO` tornou-se uma classe **completa e
   autossuficiente** que *substitui* `NAV_LINK` quando o item está ativo — eliminando
   qualquer combinação de utilitários conflitantes. Item ativo agora: **fundo brand,
   texto branco (`font-semibold`), ícone branco, indicador accent**. Hover do ativo
   aprofunda sutilmente o gradiente (sem alterar hierarquia); hover do inativo segue
   suave (`brand-50/70`), impossível confundir com ativo.
2. **Chevrons da Landing** elevados de `text-brand-200` para `text-brand-400` (visíveis
   sobre white/zinc-50, ainda claramente decorativos, `aria-hidden`).

## Tokens alterados
- `NAV_LINK` — base de itens inativos, agora com layout flex embutido e sem conflito de
  texto.
- `NAV_LINK_ATIVO` — classe standalone completa (layout + pílula brand + branco +
  `shadow` + foco `outline-accent-400`). **Nenhuma classe arbitrária espalhada** em
  componentes; a correção está inteiramente no token e no shell.
- Revisados sem alteração: `ACAO_PRINCIPAL` (família branca, AA), `BOTAO_PRIMARIO`
  (green-600/branco, sem conflito), `BOTAO_SECUNDARIO` (branco/brand, ring),
  `LINK` (accent-600, hover underline), `INPUT`/`INPUT_ERRO` (disabled `opacity-50`).

## Dashboard
Composição da Sprint 30 **intacta**. Sidebar: estado ativo imediatamente reconhecível
(texto branco legível sobre a pílula brand). Ações rápidas, hero, módulos, links e
visão geral verificados — nenhuma outra inconsistência encontrada.

## Navegação
Todos os 6 itens (Dashboard, Pacientes, Liberações, Retiradas, Usuários, Auditoria)
compartilham o mesmo token ativo. Estados verificados por módulo: INATIVO neutro /
ATIVO brand+branco+indicador accent / HOVER sutil e distinto / FOCUS com outline
visível (`accent-600` no inativo, `accent-400` no ativo). `aria-current="page"` mantido.

## CTAs
CTA verde (`ACAO_PRINCIPAL`) verificado: título branco, descrição `white/80`, ícone e
seta brancos — consistente com a Sprint 31. Botões primário/secundário/ghost sem
conflito de cor; disabled vs ativo corretamente diferenciados.

## Formulários
Login, primeiro acesso e módulos: inputs com `border-zinc-300`, foco accent + ring,
estado de erro vermelho, disabled `opacity-50`. Nenhum texto cinza sobre azul/verde;
nenhum estado disabled parecendo ativo.

## Mobile
Drawer usa o mesmo `classeLink` → estado ativo idêntico ao sidebar desktop (pílula
brand + texto branco + indicador). Botões e links com toque adequado; hero empilha;
fluxo oculto abaixo de `lg`. 360/390/430/768/1280+/1440 contemplados.

## Acessibilidade
Preservada: `aria-current="page"`, `aria-hidden` em decorativos, ícones com
`stroke="currentColor"`, foco visível (`focus-visible` outline contrastante) em itens
ativos e inativos, H1 único. O item ativo é detectável por quem enxerga cor E por
texto/navegação.

## Testes
- Componentes: **169/169 passando** (nenhum teste alterado).
- Suíte completa: falhas flutuam entre 13–31 em execuções consecutivas, **100%**
  `AuthApiError: Request rate limit reached` (429 do Supabase Auth nas integrações),
  **categoria C/ambiental** — confirmado por contagem de ocorrências em execuções
  repetidas. Nenhuma falha relacionada a layout/estados.

## Lint
`npm run lint` OK (exit 0).

## TSC
`npx tsc --noEmit` limpo.

## Build
`npm run build` OK (12 páginas + Proxy).

## Validação visual
**Pendente.** Ambiente headless sem navegador: não foi possível validar 1280+/1440/360/
390/430 nem conferir o item "Dashboard" ativo por olho humano. A correção foi validada
por token/CSS, testes e build, e o conflito de especificidade foi eliminado na raiz —
recomendada revisão em navegador antes da divulgação.

## Pendências
- Validação visual humana em navegador (item acima) — caso confirmada a leitura do
  item ativo, considerar também o `outline` do ativo em telas muito claras.
- Pendências anteriores mantidas (P3 auditoria sem trap, P3 tabela de usuários mobile,
  P1–P2 de banco/Auth/docs).

## Veredito
**APROVADA COM PENDÊNCIAS** — conflito de estados ativos eliminado na raiz (token
autossuficiente, sem combinação de utilitários), contraste dos conectores corrigido,
todos os módulos com ativo brand+branco+indicador accent, hover/focus/disabled
coerentes, CTA verde e a11y intactos, nenhum contrato funcional alterado; validação
visual humana em navegador permanece pendente.

## Sprint 31 — Refinamento final da identidade visual (visual-only)

# SPRINT 31 — REFINAMENTO FINAL DA IDENTIDADE VISUAL

## 1. Problema identificado
O CTA principal do Dashboard ("Renovar liberação" — ação dominante da Recepcionista,
renderizada por `AcaoPrincipal`) exibia **inconsistência de cor dos textos internos**:
descrição e seta usavam `text-green-100` (verde "lavado"), quebrando a leitura de um
único CTA verde. Auditada toda a superfície, toda a interface e os papéis visuais dos
CTAs.

## 2. CTA principal
Corrigido com um **token único** `ACAO_PRINCIPAL` (`visual-tokens.ts`) aplicado em
`AcaoPrincipal` (`dashboard-home.tsx`):
- **Fundo:** gradiente verde institucional mais profundo (`green-700 → green-800`) para
  garantir contraste dos textos claros (o hover escurece para `green-800/900`).
- **Título:** `text-white` puro, `font-bold`.
- **Descrição:** `text-white/80` — branco com opacidade menor (hierarquia, não "lavado").
- **Ícone:** branco (`currentColor`, tile `bg-white/15`).
- **Seta:** `text-white/90`.
- **Estados:** hover com lift + escurecimento; `active` com press (volta sem sombra e
  mais escuro); `focus-visible` com outline `green-950` visível sobre o botão e sobre a
  página. **Nenhum** azul/turquesa/texto escuro/link colorido dentro do CTA.

## 3. Dashboard
Composição da Sprint 30 **preservada** (hero institucional, fluxo, ação principal
dominante, módulos assimétricos, sidebar, visão geral). Ajustes de micro-refinamento:
contraste e hierarquia do CTA, espaçamento e alinhamentos do hero, seta/descrição do CTA.

## 4. Sidebar
Conceito mantido (pílula brand gradiente + indicador lateral turquesa + ícone branco).
Confirmado: rótulo `text-white` (sem texto escurecido sobre azul), `font-semibold`,
ícone ativo branco, hover dos itens inativos brand suave. Nenhuma alteração necessária.

## 5. Hero
Fluxo visual refinado: removida a "caixa" que envolvia as três etapas (que as fazia
parecer "três caixas dentro de um card"). Agora as etapas Identificação → Liberação →
Retirada flutuam sobre o gradiente com ícones em tile translúcido, rótulos em uppercase
tracking, setas conectivas, uma **hairline gradiente** (linha-guia do fluxo) e o selo
"Rastreável e auditável" abaixo — leitura de **elemento de produto**, não de card.

## 6. Módulos
Módulo em destaque (azul) mantido: texto branco com descrição `brand-100` (legível sobre
`brand-700`), ícone branco, "Abrir" branco, decoração circular translúcida. Módulos
neutros mantêm superfície clara, texto brand, links accent e ícones neutros/brand —
**sem** tornar tudo azul.

## 7. Tipografia
Hierarquia auditada e mantida: Título (forte, `font-bold`), Descrição (secundária,
menor e com opacidade controlada), Metadata (discreta), CTA (forte e legível). Nenhum
texto "lavado" remanescente (grep confirmou a remoção de todos os `text-green-100/200`).

## 8. Contraste
Prioridade absoluta da sprint. Decisões: fundo do CTA verde **escurecido** para AA
(branco puro + branco/80 legível); texto sobre brand sempre `brand-50/brand-100/branco`
sobre `brand-700+`; textos secundários `zinc-500/600` sobre branco mantidos. Correções
centralizadas em **tokens** (`ACAO_PRINCIPAL`, `NAV_LINK_ATIVO`), sem classes soltas.

## 9. Design tokens
`visual-tokens.ts` ganhou `ACAO_PRINCIPAL` (toda a superfície/estados do CTA dominante).
Nenhuma correção espalhada com classes arbitrárias; `globals.css` intacto.

## 10. Mobile
CTA verde valida largura total: `sm:col-span-2` → no mobile ocupa a linha inteira;
descrição com `truncate`; paddings e ícones proporcionais. Hero empilha e o fluxo
permanece oculto abaixo de `lg` (conteúdo primeiro). Sidebar vira drawer com os mesmos
ícones/indicador. 360/390/430/768 contemplados.

## 11. Acessibilidade
Preservada: roles, `aria-label`, `aria-current`, `aria-expanded`, ordem de foco e foco
visível (`focus-visible` com outline contrastante em todos os estados do CTA). Ícones
decorativos `aria-hidden`. H1 único por página. Nenhum contrato de acessibilidade
alterado.

## 12. Arquivos alterados
`components/ui/visual-tokens.ts` (novo token `ACAO_PRINCIPAL`);
`components/dashboard/dashboard-home.tsx` (AcaoPrincipal usa token; FluxoVisual
refinado); `docs/CHANGELOG.md`.

## 13. Testes
- Componentes: **169/169 passando** (nenhum teste alterado).
- Suíte completa: **468 passando / 13 falhas** — todas `AuthApiError: Request rate limit
  reached` (429 do Supabase Auth nas integrações reais), **categoria C/ambiental**, mesmo
  baseline das Sprints 28–30. Nenhuma regressão de aplicação.

## 14. Lint
`npm run lint` OK (exit 0, sem erros/avisos).

## 15. TSC
`npx tsc --noEmit` limpo.

## 16. Build
`npm run build` OK (12 páginas + Proxy).

## 17. Validação visual
**Pendente.** Ambiente headless sem navegador real: não foi possível inspecionar
Dashboard/Landing/Login/jornadas em 1280/1440/360/390/430. A correção do CTA verde foi
validada por código, testes e build, mas **não** por olho humano — recomendada revisão
visual em navegador antes da divulgação.

## 18. Pendências
- Validação visual humana (item 17) e pendências anteriores (P3 auditoria sem trap;
  P3 tabela de usuários mobile; P1–P2 de banco/Auth/docs).
- Sugestão: validar contraste do CTA verde com ferramenta de acessibilidade (ex.: axe/
  Lighthouse) no navegador.

## 19. Veredito
**APROVADA COM PENDÊNCIAS** — CTA verde com texto branco consistente (título/descrição/
ícone/seta), papéis de CTA respeitados, hero/fluxo refinados, tokens centralizados,
contrastes priorizados, a11y e contratos intactos; validação visual humana em navegador
real permanece pendente.

## Sprint 30 — Evolução visual premium (visual-only)

# SPRINT 30 — EVOLUÇÃO VISUAL PREMIUM

## 1. Estado antes
A Sprint 29 entregou a fundação: paleta, marca, tokens, gradientes, profundidade básica,
cards, sidebar e composição inicial. Diagnóstico: interface **consistente**, porém com
proporções uniformes — elementos em "caixas iguais", sidebar convencional, header de SaaS
genérico e hierarquia ainda tímida.

## 2. Problemas visuais encontrados
- Ações rápidas: cards quase idênticos, sem ação dominante.
- Módulos: três caixas do mesmo peso, sem assimetria.
- Sidebar: item ativo parecia apenas "retângulo azul atrás do texto".
- Header: sem presença institucional (sem identidade visual própria).
- Ícones: não existiam na navegação; azul/turquesa repetidos sem função de hierarquia.
- Tipografia: pesos e tamanhos próximos em toda a interface.

## 3. Direção artística
Mesmo norte da Sprint 29 (referência como princípio, sem cópia): composição grande,
assimetria, tipografia protagonista, respiro, camadas, formas geométricas, superfícies
sofisticadas. Princípios aplicados: **verde = ação**, **azul = identidade/estrutura**,
**turquesa = destaque/link** (cor com função), poucos elementos porém mais impactantes.

## 4. Dashboard
Recomposto na home (`dashboard-home.tsx`): **hero institucional** (faixa gradiente
brand-900 com glow, eyebrow "Controle institucional", H1 de saudação branco, chip de
perfil/estado e fluxo abstrato Identificação → Liberação → Retirada com selo "Rastreável
e auditável" — sem dados inventados) → **Ações rápidas** → **Módulos** → **Visão geral**.
Espaçamentos maiores (max-w-6xl, gap-8), menos bordas, mais superfície.

## 5. Landing
Permanece a referência máxima e **não foi alterada** — o Dashboard passou a usar a mesma
linguagem de faixa gradiente brand, garantindo que Landing → Login → Dashboard pertençam
ao mesmo produto.

## 6. Login
Mantido do Sprint 29 (já premium e alinhado): marca, profundidade, superfície branca e
tipografia coerentes. Nenhuma alteração necessária nesta sprint.

## 7. Navegação
- **Sidebar** (`dashboard-shell.tsx`): itens agora com **ícone + rótulo**; item ativo é
  pílula gradiente brand com **indicador lateral turquesa** (barra accent-400 à esquerda)
  e ícone branco — leitura de "produto", não de template. Inativos: ícone neutro que
  acende brand no hover.
- **Header:** hairline identitária no topo (gradiente brand → accent → green) para
  reforçar a marca; marca `MarcaSistema` mantida.
- Ícones compartilhados em `components/dashboard/icones.tsx` (sidebar + home).

## 8. Módulos
`ModuleCard` ganhou variante **destaque** (primeiro módulo): superfície gradiente brand,
ocupa 2 colunas, glow e círculo decorativo — cria **assimetria** e peso visual. Os demais
permanecem superfícies brancas com tile **neutro** (reduz a repetição de azul). Grade:
featured(2) + regulares em 3 colunas. Nenhum módulo criado; descrições reais mantidas.

## 9. Formulários
Sem mudança de lógica, validações ou a11y. `PageHeader` (todas as jornadas) elevado
(título `text-2xl sm:text-3xl font-bold`, descrição maior) e `EstadoVazio` refinado
(superfície mais leve). Modais e focus trap/escape intactos.

## 10. Superfícies
Redução da dependência de bordas: `ring` quase imperceptível + sombras extremamente
sutis; superfícies com propósito (faixa escura do hero = protagonista; brancas = dados;
gradiente verde = ação principal; gradiente brand = identidade/módulo em destaque).

## 11. Tipografia
H1 de saudação `text-3xl/4xl font-bold` branco sobre faixa escura; títulos de seção
`font-bold tracking-tight`; eyebrows `uppercase tracking-widest`; descrições em `text-base`
com `leading` confortável; metadata discreta. Hierarquia PEQUENO/MÉDIO/GRANDE/
PROTAGONISTA estabelecida.

## 12. Cores
Paleta **inalterada**; proporção corrigida: verde reservado à ação principal (faixa do
primeiro "Ações rápidas"), brand à identidade (hero, módulo destaque, sidebar ativa),
turquesa a destaque/link/indicador. Tiles neutros nos cards comuns evitam "azul em todos
os ícones".

## 13. Microinterações
Sutis e funcionais: hover com lift/translate-y, seta que desliza, ícone que acende no
hover da sidebar, indicador lateral estático. Sem bounce, sem animação permanente; foco
visível preservado.

## 14. Mobile
Hero empilha (texto → chips), fluxo visual oculto abaixo de `lg` (conteúdo primeiro);
ação principal e módulo destaque ocupam a linha inteira (`sm:col-span-2`); drawer mobile
herda ícones/indicador da navegação. Breakpoints 360/390/430/768/1024/1280+ contemplados.

## 15. Acessibilidade
Roles, `aria-label`, `aria-current`, `aria-expanded`, ordem de foco e foco visível
intactos; ícones decorativos com `aria-hidden` (nomes acessíveis preservados — todos os
testes passam); H1 único por página; contraste mantido nos chips sobre faixa escura.

## 16. Contratos preservados
Nenhuma alteração em domínio/Auth/RLS/banco/migrations/triggers/policies/services/
repositories/actions/regras. Nenhuma métrica, dado, estado, permissão ou funcionalidade
inventada. Nenhuma cópia da referência. Textos institucionais testados intactos.

## 17. Arquivos alterados
`components/dashboard/icones.tsx` (novo); `components/dashboard/dashboard-shell.tsx`;
`components/dashboard/dashboard-home.tsx`; `components/dashboard/module-card.tsx`;
`components/ui/visual-tokens.ts` (`NAV_LINK_ATIVO` com `relative`);
`components/ui/page-header.tsx`; `components/ui/estado-vazio.tsx`;
`docs/CHANGELOG.md`.

## 18. Testes
- Antes: 169/169 componentes; 468/13 na suíte (13 = 429 rate limit).
- Depois: **169/169 componentes**; suíte não-auth **100% verde**; integração flutua
  entre 12–27 falhas, **todas** `AuthApiError: Request rate limit reached` (categoria C,
  ambientais, não-determinísticas — variam conforme o rate limit do Supabase Auth).
  Nenhum teste foi alterado; nenhuma regressão de aplicação.

## 19. Lint
`npm run lint` OK (exit 0; 0 erros, 0 avisos após limpeza de imports).

## 20. TSC
`npx tsc --noEmit` limpo.

## 21. Build
`npm run build` OK (12 páginas + Proxy, sem erros).

## 22. Validação visual real
**Pendente.** Não há navegador disponível no ambiente de execução (headless). A
recomposição foi validada por testes automatizados, lint, tipos e build, mas **não** por
inspeção visual em navegador real. Recomenda-se revisar Dashboard (hero, ações, módulos,
sidebar), Landing, Login e uma jornada operacional em 360/390/430/768/1024/1280+.

## 23. Pendências
- Validação visual humana (item 22) e pendências anteriores (P3 auditoria sem trap;
  P3 tabela de usuários mobile; P1–P2 de banco/Auth/docs).
- Teste do espelho (sem cores): a composição mantém-se premium por assimetria,
  hierarquia e respiro; recomendado confirmar visualmente no navegador.

## 24. Veredito
**APROVADA COM PENDÊNCIAS** — evolução da composição executada (hero institucional,
ação principal dominante, módulos assimétricos, sidebar com ícones/indicador, header com
identidade, tipografia com hierarquia), contratos e testes intactos; validação visual
humana em navegador real permanece pendente.

## Sprint 29 — Reconstrução visual premium (visual-only)

**Objetivo:** elevar toda a interface para uma linguagem visual premium, profissional e
coesa, tomando como **direção artística** a composição da referência apresentada pelo
usuário (ConsultClinic) — **sem copiar** textos, marca, imagens ou layout literal — e
preservando integralmente identidade, textos institucionais, domínio, permissões,
contratos, funcionalidades e dados reais. **Nada** de banco/migrations/RLS/triggers/
funções/repositories/services/domain/permissões/Auth/Server Actions/regras foi alterado;
**nenhuma** funcionalidade, página ou fluxo novo foi criado; **nenhum** dado, número,
paciente ou métrica foi inventado.

### 1. Resumo executivo
Landing reconstruída como vitrine institucional premium (header fixo com blur, hero
assimétrico com destaque cromático e composição visual em camadas, seções com hierarquia
tipográfica e CTA final em faixa escura); Dashboard elevado para a mesma linguagem
(sidebar mais leve, estado ativo como pílula brand sólida, cards com menos caixas);
Login e Primeiro acesso com superfícies e profundidade renovadas. Contratos testados
(textos, roles, hrefs, âncoras, a11y) preservados: **169/169** testes de componente e
**468/13** na suíte completa (13 = 429 rate limit do Supabase Auth, categoria C).

### 2. Direção visual adotada
- **Composição da referência, não cópia:** assimetria no hero, texto à esquerda e
  elemento visual à direita; profundidade em camadas (fundo → glow → formas geométricas →
  card → elemento interno); hierarquia tipográfica forte; ritmo e respiro generosos.
- **Paleta mantida** (globals.css intacto — fonte única de verdade): azul institucional
  (brand) para marca/títulos/estrutura, turquesa (accent) para destaques, verde para
  ações primárias, neutros claros. Sem excesso de verde, sem neon, sem sombras pesadas,
  sem "template".
- **Cards como exceção, não regra:** superfícies brancas com `ring` sutil e sombra leve;
  as seções institucionais priorizam espaço, tipografia e um único destaque por card.

### 3. Comparação conceitual com a referência
A referência sugeriu: hero de alto impacto com CTA evidente + elemento visual à direita;
profundidade por camadas; tipografia forte; cards com leve elevação no hover; estados
ativos sofisticados de navegação. Aplicamos **a mesma linguagem** com **identidade
própria do sistema**: o elemento visual do hero é um cartão abstrato que representa o
**fluxo do benefício** (Identificação → Autorização → Registro, com selo "Rastreável" e
barra "Controle institucional") — sem nenhum dado inventado e sem iconografia médica
genérica. Nenhum texto, logo ou imagem da referência foi utilizado.

### 4. Paleta e fundações
`app/globals.css` **inalterado** (Estratégia A). `components/ui/visual-tokens.ts`
refinado sem quebrar nenhum export: `CARTAO` agora é superfície com `ring` +
profundidade sutil (hover removido para que cada card defina seu comportamento);
`BOTAO_SECUNDARIO` com `ring` em vez de borda e hover suave; `NAV_LINK_ATIVO` virou
pílula gradiente brand sólida com sombra; novos `EYEBROW`, `TITULO_SECAO`, `SUBTITULO`.
Nova marca reutilizável em `components/ui/marca.tsx` (`MarcaIcone` — bilhete institucional
em gradiente brand — e `MarcaSistema`), com accessible name exatamente "Vale Transporte
CAPS".

### 5. Landing — Header
Header fixo (`sticky`), `backdrop-blur`, borda inferior sutil; marca `MarcaSistema` à
esquerda; navegação "Navegação da página" (Início, O que organiza, Como funciona,
Segurança, Fluxo) com `NAV_LINK` e hover suave; CTA primário verde "Entrar no sistema".
**Correção de âncora morta:** "Como funciona" deixou de apontar para o inexistente
`#como-funciona` e agora aponta para `#fluxo` (seção que explica o funcionamento) — no
header e no drawer mobile.

### 6. Landing — Hero
Seção `#inicio` com glow em camadas; eyebrow "Sistema institucional"; H1 grande com
"CAPS" em gradiente turquesa (`bg-clip-text`), mantendo o accessible name "Vale
Transporte CAPS"; subtítulo; CTA primário + CTA secundário "Como funciona →"; três
indicadores de confiança com ícones distintos (Controle, Segurança, Rastreabilidade).
À direita, `HeroVisual`: composição em camadas (glow radial, quadrado rotacionado,
círculo de borda, formas menores) envolvendo um card com o fluxo do benefício e a barra
"Controle institucional". Sem números inventados.

### 7. Landing — Seções institucionais
- **`#organiza`:** eyebrow "Módulos", H2 "O que o sistema organiza"; 5 cards de módulo
  com tile de ícone em gradiente brand, linha de topo accent no hover e elevação sutil —
  textos exatos preservados.
- **`#seguranca`:** H2 "Controle e segurança"; princípios em cards leves com check
  turquesa em círculo accent.
- **`#fluxo`:** H2 "Como o benefício flui"; 4 etapas numeradas (Paciente, Liberação,
  Retirada, Auditoria) em cards com número em gradiente accent e seta conectora (desktop).

### 8. Landing — CTA final e footer
- **`#acesso`:** faixa escura gradiente brand com glows turquesa/azul, eyebrow "Acesso
  institucional", H2 "Continue o acompanhamento", parágrafo e CTA primário verde.
- **Footer:** marca `MarcaSistema`, descrição, bloco "Acesso" com link turquesa e rodapé
  com `© {ano} Vale Transporte CAPS`.

### 9. Dashboard — Shell e sidebar
Header fixo com blur e marca `MarcaSistema` (link "Vale Transporte CAPS" → `/dashboard`);
sidebar desktop (aside sticky) com `NAV_LINK` e `NAV_LINK_ATIVO` em pílula brand sólida
(`aria-current="page"` preservado); card de conta com perfil/e-mail/estado e `LogoutButton`;
breadcrumb "Navegação estrutural" mantido; drawer mobile com marca e navegação idênticas.

### 10. Dashboard — Home, ações rápidas e cards
H1 de saudação maior (`Bom dia!/Boa tarde!/Boa noite!` — texto exato preservado),
subtítulo "O que você precisa fazer hoje?"; ações rápidas com tile de ícone em gradiente
accent e hover com elevação; `ModuleCard` com tile brand e hover lift; visão geral da
conta em `dl` premium. Estados inativo/sem vínculo mantidos ("Usuário inativo", "Sem
perfil funcional").

### 11. Login e primeiro acesso
Login: fundo com gradiente suave + glows, `MarcaIcone` grande, card `rounded-3xl` com
profundidade forte, "Entrar na sua conta" preservado. Primeiro acesso: header com marca
+ `MarcaIcone`, card premium, pill "Primeiro acesso", "Defina sua nova senha".

### 12. Formulários e modais
Nenhuma lógica alterada. Formulários mantêm clareza e produtividade (campos `INPUT`,
validação, mensagens de erro, botões `BOTAO_PRIMARIO`/`BOTAO_SECUNDARIO`). Modais
mantêm acessibilidade completa: foco no diálogo, Escape, **trap de Tab**, restauração de
foco (`useModalA11y`) e os modais próprios de Auditoria (foco no painel + Escape +
restauração via `gatilhoRef`).

### 13. Mobile
Mobile-first preservado: drawer mobile com fundo `backdrop-blur` e marca; hero empilha
(visual acima do texto) com CTAs empilháveis; grades colapsam de 1 → 2 → 3 colunas;
tabelas mantêm rolagem horizontal nas views; breakpoints 360/390/430/768/1024/1280+.

### 14. Acessibilidade
Roles, `aria-label`, `aria-current`, `aria-expanded`, foco visível e ordens de tabulação
intactos (verificados pelos testes). O H1 do hero e as marcas continuam expondo o texto
exato "Vale Transporte CAPS" para leitores de tela; ícones decorativos com `aria-hidden`;
elementos decorativos sem texto acessível.

### 15. Design System
`components/ui/visual-tokens.ts` (tokens refinados + `EYEBROW`/`TITULO_SECAO`/
`SUBTITULO`), `components/ui/marca.tsx` (novo, marca reutilizável). `globals.css`
inalterado. Nenhuma biblioteca de UI nova.

### 16. Arquivos alterados
`components/ui/visual-tokens.ts`; `components/ui/marca.tsx` (novo);
`components/landing/landing.tsx`; `components/landing/mobile-nav.tsx`;
`components/dashboard/dashboard-shell.tsx`; `components/dashboard/dashboard-home.tsx`;
`components/dashboard/module-card.tsx`; `app/login/page.tsx`; `app/primeiro-acesso/page.tsx`;
`docs/CHANGELOG.md`.

### 17. Arquivos NÃO alterados (contratos preservados)
Banco/migrations/RLS/triggers/funções; `lib/` (domain/repositories/services/regras/
enums); `app/actions/`; Supabase Auth e primeiro acesso; `app/globals.css`;
`app/layout.tsx`; formulários (`login-form`, `primeiro-acesso-form`, `paciente-form`,
`liberacao-form`, `retirada-form`, `novo-usuario-form`); views de módulos (Pacientes,
Liberações, Retiradas, Usuários, Auditoria) e seus modais; `tests/` (nenhum teste
alterado). Todas as views herdam o novo `CARTAO` automaticamente via tokens.

### 18. Testes
- Componentes: **169/169 passando** (mesmo total da Sprint 28; nenhum teste alterado).
- Suíte completa: **468 passando / 13 falhas** — as 13 são `AuthApiError: Request rate
  limit reached` (429) do Supabase Auth nas integrações reais (categoria C, ambientais,
  mesmo baseline 468/13 da Sprint 28). Nenhuma falha de aplicação.

### 19. Lint / TypeScript / Build
`npm run lint` OK (exit 0); `npx tsc --noEmit` limpo; `npm run build` OK (12 páginas
+ Proxy, sem erros).

### 20. Validação visual humana
**Pendente.** A reconstrução foi validada por testes automatizados e build, mas não por
inspeção visual em navegador real (ambiente headless). Recomenda-se revisar Landing,
Dashboard, Login e Primeiro acesso em 360/390/430/768/1024/1280+ antes da divulgação.

### 21. Pendências e Veredito
- Pendência de validação visual humana (item 20).
- Pendências registradas anteriormente permanecem (P3 diálogo de Auditoria sem trap de
  Tab; P3 rolagem horizontal da tabela de usuários no mobile; pendências P1–P2 de banco/
  Auth e docs das Sprints anteriores).
- **Veredito: APROVADA COM PENDÊNCIAS** — todos os contratos testados preservados, sem
  regressões e com a linguagem premium aplicada; validação visual humana em navegador
  real segue pendente.

## Sprint 24 — Identidade visual premium (visual-only)

**Objetivo:** aplicar uma identidade visual institucional premium (azul, turquesa,
verde, fundos claros, cartões brancos, tipografia forte, mobile-first) a toda a UI —
**sem tocar** em banco/migrations/RLS/triggers/funções/repositories/services/domain/
permissões/Auth/primeiro acesso/Server Actions/regras de negócio e **sem criar
funcionalidades, páginas ou fluxos novos**.

### Paleta oficial e tokens (`app/globals.css`, `components/ui/visual-tokens.ts`)
- `@theme` Tailwind v4 com as escalas **brand** (azul institucional profundo, 50–950)
  e **accent** (turquesa, 50–950) + `--color-success` (verde, ações principais/sucesso);
  fundo geral claro `#f7f9fb`; fonte Geist mantida (tipografia forte, `--font-sans`/mono).
- **Dark mode não implementado**; o media query `prefers-color-scheme` que trocava
  `--background/--foreground` foi **removido** por interferir na identidade única.
- `visual-tokens.ts` ampliado: `BOTAO_PRIMARIO` agora verde (`green-600/700`),
  `BOTAO_SECUNDARIO` neutro, novos `BOTAO_PERIGO`, `BOTAO_FANTASMA`, `FOCO`,
  `TITULO_PAGINA`, `SUBTITULO_PAGINA`, `BADGE_SUCESSO/NEUTRO/AVISO/ERRO`; links e
  foco visível em turquesa/`brand-600`; `INPUT` com foco `brand-600`.

### Aplicação por área (somente aparência)
- **Landing:** header/marca `brand-900`, pill "Sistema institucional" turquesa, hero,
  cards de módulos com ícones em `accent-50`/`accent-700`, princípios e etapas com
  destaque turquesa/brand, footer com link turquesa.
- **Login e primeiro acesso:** headers/marca `brand-900`, pill turquesa, título
  `brand-900`, toggle de senha com hover/foco da marca.
- **Dashboard:** títulos `brand-900`, breadcrumb com link turquesa e item atual
  `brand-900`, nav ativa turquesa (`NAV_LINK_ATIVO`), cards de módulos e ações rápidas
  com hover turquesa suave, ícones `accent-50`, "Abrir" turquesa, logout com
  `BOTAO_PRIMARIO`.
- **Jornadas Pacientes/Liberações/Retiradas:** `PageHeader` já centraliza títulos
  `brand-900`; nomes/destaques em `brand-900`; steppers e seletores de tipo/liberação
  ativos em `brand-600`; badges de status unificados via tokens (verde/cinza/vermelho).
- **Usuários e Auditoria (padronização + identidade):** views migradas para
  `PageHeader`/`EstadoVazio`/`FeedbackErro` + tokens (`BOTAO_PRIMARIO/SECUNDARIO`,
  `INPUT`, `LINK`, `CARTAO`), corrigindo as inconsistências detectadas na auditoria;
  filtros de auditoria com foco `brand-600`; botão "Filtrar" primário verde; links
  "Detalhes"/"Ver detalhes" turquesa; modal de detalhes com destaque `brand-900`;
  `novo-usuario-form` com botões padronizados; `error.tsx` dos 5 módulos com
  `BOTAO_PRIMARIO`; `usuario-status` unificado com os demais badges.
- `.gitignore` passa a ignorar `supabase/.temp/` (artefato local do CLI sem valor).

### Validação
- **464 testes passando** (não-auth); falhas restantes são todas
  `AuthApiError: Request rate limit reached` (429) do Supabase Auth — ambientais,
  como no Sprint 23, **sem nenhuma falha de aplicação**; nenhum teste foi alterado.
- `npm run lint`, `npx tsc --noEmit` e `npm run build` OK; bundle CSS confirma a
  geração das utilities `brand`/`accent`; secret scan limpo (apenas referências a
  nomes de variáveis/placeholders). **Nenhuma alteração fora da camada visual.**

## Sprint 21 — Consulta de Auditoria pela gestão (leitura da trilha)

**Objetivo:** entregar `/dashboard/auditoria` — consulta de **leitura** de
`auditoria_logs` (append-only, RLS `auditoria_select_gestor`) exclusiva do **Gestor
ativo**, com filtros e paginação aplicados no servidor e detalhes Antes/Depois
legíveis — **sem alterar** migrations/policies/triggers/banco e sem inventar dados
(os eventos exibidos são exatamente os gerados pelas funções `*_audit`, migration 07).

### Página e listagem (`/dashboard/auditoria`)
- `page.tsx` (Server Component) com sessão real + gate `permissoesAuditoria()`; página
  inválida normaliza para 1; datas fora do formato `YYYY-MM-DD` são ignoradas; nomes
  dos responsáveis para o filtro vêm de `listarUsuariosAction` (action sancionada);
  `loading.tsx`/`error.tsx` no padrão dos demais módulos.
- `auditoria-view.tsx` — filtros **GET** (ação, entidade, responsável, de/até) aplicados
  no PostgREST (`eq`/`gte`/`lte`), tabela desktop + cards mobile, contador de eventos,
  paginação com links que **preservam os filtros**; vazio/erro sem tela branca.
- `auditoria-detalhe.tsx` — modal acessível (foco no painel, ESC fecha, foco retorna ao
  gatilho) com os pares **Campo/Antes/Depois** formatados (enums/booleano/datas pt-BR).

### Camada de dados/regras (sem migration)
- `lib/domain/auditoria/types.ts` — `EventoAuditoria`, `FiltrosAuditoria`, resultado com
  paginação (`POR_PAGINA_AUDITORIA = 20`).
- `lib/domain/auditoria/labels.ts` — funções PURAS de rótulo/formatação; fallback
  técnico para valores desconhecidos; **CPF excluído por defesa em profundidade**
  (além de já não existir em `pacientes_audit`).
- `lib/repositories/auditoria-repository.ts` — `listar` com normalização de termos,
  fim-do-dia em `ate` (input date inclui o dia todo), paginação e embed do responsável
  (`usuarios(id, nome)` — só o Gestor enxerga via RLS).
- `lib/services/auditoria-service.ts` — somente leitura (sem criar/atualizar/excluir);
  valida a página antes de consultar.
- `app/actions/auditoria.ts` — `listarAuditoriaAction` no padrão das retiradas:
  `exigirUsuarioAtivo()` (sessão + vínculo + ativo) + gate `PERFIS.GESTOR`; mensagens
  seguras (só `AppError` exposto).
- `lib/domain/regras.ts` — `permissoesAuditoria(perfil, ativo)` espelhando a policy
  `auditoria_select_gestor`; `capacidadeDashboard` ganhou `auditoria`.

### Dashboard/Shell
- `dashboard-shell.tsx`/`dashboard-home.tsx` — "Auditoria" deixou de ser "Em
  desenvolvimento" e virou **link/card reais** (gated por `modulos.auditoria`);
  `MODULOS_PLANEJADOS` ficou vazio e a seção "Em desenvolvimento" é oculta quando vazia.

### Testes (436 não-auth passando)
- Novos: `auditoria-labels.test.ts` (rótulos, formatação de enums/datas/booleano, CPF
  oculto, ordenação pt-BR), `auditoria-service.test.ts` (delegação, página inválida,
  serviço somente leitura) e `auditoria-view.test.tsx` (listagem/contador, filtros GET,
  paginação preservando filtros, modal com Antes/Depois, CPF nunca exibido, ESC).
- Atualizados: `dashboard-shell.test.tsx`/`dashboard-home.test.tsx` (Auditoria = link
  real para o Gestor; autorizador/recepcionista não veem; sem "Em desenvolvimento").

### Sem alterações
- Nenhuma migration/policy/trigger/função/banco alterada (`auditoria_logs` continua
  append-only e legível só pelo Gestor ativo). Sem biblioteca de UI nova.

### Validação
- `npx tsc --noEmit`, `eslint .` e `vitest run` não-auth (436/436) OK; as falhas de
  integração real são `AuthApiError: Request rate limit reached` (rate limit do Supabase
  Auth ao autenticar dezenas de vezes) — ambientais, sem relação com a sprint.

## Sprint 20 — Página operacional de Retiradas (UX/UI da recepção)

**Objetivo:** entregar `/dashboard/retiradas` com dados reais — a recepção registra a
retirada do paciente pelo balcão (Paciente → Liberação → Quantidade → Revisão) e o
gestor acompanha — sem alterar nenhuma migration/RLS/trigger/banco e sem inventar
dados. O banco permanece a autoridade: identidade (`recepcionista_id`) e `data_hora`
são preenchidas pelo trigger `fn_retiradas_before` (RN28); o saldo é confirmado no
momento do registro.

### Página e listagem (`/dashboard/retiradas`)
- `page.tsx` (Server Component) com sessão real + gate `permissoesRetiradas()`; `loading.tsx`/`error.tsx`.
- `retiradas-view.tsx` — listagem mobile-first (tabela desktop + cards mobile) com
  **dados reais**: o read-model embute paciente (sem CPF), liberação e responsável
  pelo padrão do `LiberacaoRepository` (Sprint 18); embeds são **best-effort** (o que
  o leitor não enxerga via RLS vira "—"; responsável só o gestor vê —
  `usuarios_select_gestor`); `formatarDataHora` determinístico (sem fuso) para a UI.
- CTA "Registrar retirada" **somente** para recepcionista ativa.

### Registro em 4 etapas (`retirada-form.tsx`)
- Stepper **Paciente → Liberação → Quantidade → Revisão** com validação por passo.
- **Saldo calculado no cliente** com dados reais: `liberacao.quantidade − Σ retiradas`
  (`listarLiberacoesAction(paciente.gestor_sus)` + `listarRetiradasAction()`); quantidade
  pré-selecionada em 1 e limitada ao disponível; aviso de que o valor final é
  confirmado no banco.
- Submissão envia **apenas** `{ liberacaoId, pacienteId, quantidade }` — nunca
  `recepcionista_id`/`data_hora` (RN28); sucesso, erro amigável (`mapSupabaseError`
  já cobre todas as mensagens do trigger: SALDO_INSUFICIENTE, LIBERACAO_INATIVA,
  RETIRADA_FORA_DA_VALIDADE, PACIENTE_INATIVO, NAO_ENCONTRADO, ACESSO_NEGADO).

### Camada de dados/regras (sem migration)
- `lib/domain/retiradas/types.ts` — `RetiradaComDetalhes` + resumos embutidos
  (`LiberacaoResumo`, `UsuarioResumo`, re-export `PacienteResumo`).
- `lib/repositories/retirada-repository.ts` — `listar`/`buscarPorId` com embeds
  (`pacientes/liberacoes/usuarios`) e `criar` sem identidade/data do cliente.
- `lib/services/retirada-service.ts` — `listarRetiradas`/`buscarRetirada` enriquecidos; `registrarRetirada` valida RN14 antes do banco.
- `app/actions/retiradas.ts` — endurecida no padrão de liberações: `exigirUsuarioAtivo()`
  (sessão + vínculo + ativo) e `registrarRetiradaAction` exige recepcionista; mensagens
  seguras (só `AppError` exposto).
- `lib/domain/regras.ts` — `permissoesRetiradas(perfil, ativo)`: acesso = ativo && (recep
  || gestor); registrar = ativo && recep; `capacidadeDashboard` ganhou `retiradas`.

### Dashboard/Shell
- `dashboard-shell.tsx`/`dashboard-home.tsx` — "Retiradas" deixou de ser "Em
  desenvolvimento" e virou **link real** (gated por `modulos.retiradas`);
  `MODULOS_PLANEJADOS = ["Auditoria"]`; texto "Próximo módulo ... Auditoria".

### Testes (379 não-auth passando; 35 arquivos)
- Novos: `retiradas-view.test.tsx` (tabela/cards, CTA só recep, responsável só gestor,
  fallback "—", vazio/erro) e `retirada-form.test.tsx` (4 etapas, saldo calculado,
  limite de quantidade, validação por passo, envio só dos dados do negócio, sucesso/erro).
- Novos: `retirada-repository.test.ts` (embeds, mapeamento, sem CPF) e
  `retiradas-actions.test.ts` (gates: recep OK; gestor/autorizador/inativo/sem-vínculo
  bloqueados; mensagens seguras).
- Atualizados: `retirada-service.test.ts`, `regras.test.ts` (`permissoesRetiradas`),
  `dashboard-shell.test.tsx`/`dashboard-home.test.tsx` (Retiradas = link real; Auditoria
  segue planejada).
- **Integração real `retiradas.integration.test.ts` (6/6, env-guarded, cleanup via
  service role)**: recep registra com identidade/data_hora do banco + log
  `retirada.registrada`; gestor lista com FKs embutidas e sem CPF; saldo respeitado pelo
  trigger (SALDO_INSUFICIENTE); gestor bloqueado no INSERT (ACESSO_NEGADO com liberação
  real); autorizador não enxerga retiradas (RLS SELECT → lista vazia); inativo bloqueado.
  Documentado o comportamento de **ordem trigger-before-RLS**: com liberação inexistente
  o trigger levanta NAO_ENCONTRADO antes do RLS (sem vazar existência).

### Sem alterações
- Nenhuma migration/policy/trigger/função/banco alterada (retiradas continua append-only,
  sem update/delete). Sem biblioteca de UI nova. `retiradas` já existia desde a Sprint 08.

### Validação
- `npm test` (não-auth) 379/379; integração de retiradas 6/6 no banco real; `npx tsc --noEmit`,
  `npm run lint` e `npm run build` OK; `git status`/`git diff` restritos ao escopo.
- Observação: testes de integração em paralelo podem falhar com **429 rate limit do
  Supabase Auth** (excesso de `signInWithPassword`) — transitório e ambiental.

### Pendências
- **Comprovante de retirada** (DECISÃO PENDENTE) e **retirada parcelada / múltiplas
  liberações ativas** (DECISÕES PENDENTES) seguem sem implementação.
- Validação manual no browser (jornada completa de retirada, mobile/desktop).

## Sprint 19 — Redesign UX/UI da jornada de liberações

**Objetivo:** elevar a experiência de `/dashboard/liberacoes` ao padrão premium mobile-first das demais telas (Sprints 13–17) — sem criar infraestrutura, sem tocar em banco/RLS/migrations, services, repositories, actions ou regras de domínio. Apenas UI + testes + docs.

### Formulário em etapas (`liberacao-form.tsx`)
- Fluxo guiado em **4 passos** com stepper visível: **Paciente → Tipo e quantidade → Período → Revisão**, seguindo o fluxo especificado (selecionar paciente → quantidade → período → revisar → criar).
- Validação **por etapa** (`errosDoPasso`/`avancar`) com as mesmas regras do servidor — só avança com o passo completo; erros limpos ao editar o campo.
- Passo **Revisão** com resumo (Paciente/Gestor SUS, Tipo, Quantidade, Período) antes do botão "Criar liberação"; "Voltar" preserva os dados já informados.
- Renovação mantém fluxo **distinto** (sem stepper): resumo somente-leitura da liberação original + banner "Renovação"; cliente continua enviando apenas `{ renovacaoDeId }`.
- Submissão agora lê os valores **do estado controlado** (não do FormData) — comportamento idêntico, decoração de DOM mais robusta.
- Adotados os tokens visuais (`BOTAO_PRIMARIO`, `BOTAO_SECUNDARIO`, `INPUT`, `ROTULO`) — consistência com Landing/Login/Dashboard.

### Listagem (`liberacoes-view.tsx`)
- Tokens visuais (`CONTAINER`, `CARTAO`, `BOTAO_PRIMARIO/SECUNDARIO`, `INPUT`, `LINK`) na listagem (tabela desktop + cards mobile preservados).
- **Contador de resultados** ("N liberações registradas." / "para esta busca.") com `aria-live`.
- **Feedback pós-salvar**: banner transitório de sucesso (5s) após criar/renovar, antes do `router.refresh()`.

### Testes
- `liberacao-form.test.tsx` reescrito para o fluxo em etapas (+2): exibe etapas/campos, bloqueia avançar sem paciente, resumo no passo Revisão, envio server-side, erro amigável, **voltar preserva dados**; renovação inalterada.
- `liberacoes-view.test.tsx` (+2): contador de resultados e **feedback de sucesso pós-criação com `router.refresh`**.
- `liberacoes.integration.test.ts`: **novo teste (7º)** provando que o **autorizador NÃO renova** no banco real — valida a migration **20260813000002** (aplicada), que fecha o gap de RLS da Sprint 18 (`liberacoes_insert_autorizador` agora exige `renovacao_de_id is null`).

### Sem alterações
- Nenhuma migration/policy/trigger/função/banco alterada (a migration 20260813000002 foi **aplicada pelo usuário** antes desta sprint e não faz parte do diff). `lib/services`, `lib/repositories`, `app/actions`, `lib/domain/regras`, autenticação e `lib/auth/profile.ts` intocados. Sem biblioteca de UI nova.

### Validação
- `npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build` OK; `git status`/`git diff` restritos ao escopo de UI/testes/docs; secret scan limpo.

### Pendências
- **Quantidade utilizada / saldo restante por liberação** ainda não aparece na listagem — o modelo não expõe esse dado (retiradas fora do escopo); registrar quando a Fase 6 (Retiradas) existir.
- Validação manual no browser da nova jornada (etapas, renovação, mobile/desktop) — aguarda navegador humano.

## Sprint 18 — Liberações operacionais (página, renovação pela recepção e correção real de auditoria)

**Objetivo:** entregar a página operacional de Liberações (`/dashboard/liberacoes`) com dados reais — autorizador cria, recepção renova, gestor lê — e corrigir o **bug real** que impedia qualquer INSERT em `pacientes`/`liberacoes`/`retiradas`: a trigger `fn_auditoria()` acessava `new.auth_user_id` mesmo para tabelas que não têm esse campo (`record "new" has no field "auth_user_id"`).

### Correção de auditoria (migration 20)
- **Bug reproduto** contra o projeto real: INSERT (autenticado e service role) em `pacientes`/`liberacoes` falhava por causa do `fn_auditoria` (migration 07, linhas 245–246).
- **Migration `20260813000001_fix_auditoria_auth_user_id.sql`**: `fn_auditoria()` reescrita com `IF` aninhado (o ramo `usuarios` só acessa `new.auth_user_id` quando `tg_table_name = 'usuarios'`). Única mudança vs. migration 07 (validada por diff); **aprovada e aplicada pelo usuário** no SQL Editor.
- **Validação real**: o seed (upsert em `pacientes`/`usuarios`, que passam pela trigger) e os 6 testes de integração de liberações passam contra o banco — a correção está confirmada no projeto.

### Página de Liberações (`/dashboard/liberacoes`)
- Reutilizada a infraestrutura já existente (tipos, `LiberacaoRepositoryPostgres`, `LiberacaoService`, actions, componentes) — navegação já estava preparada (shell, `MODULOS_PLANEJADOS`, card no dashboard).
- Listagem mobile-first (tabela desktop + cards mobile) com busca por paciente/Gestor SUS resolvida no servidor via `v_pacientes` (sem CPF), estados vazio/erro e badges de status (Ativa/Expirada/Cancelada). Lista da recepção mostra apenas liberações **ativas** (RLS).

### Criação e renovação (identidade 100% server-side)
- `criarLiberacaoAction` refatorada: **NOVA** → somente `profissional_autorizador` ativo, com `profissional_autorizador_id` resolvido via `public.usuario_atual_id()` (o cliente não envia); **RENOVAÇÃO** → somente `recepcionista`, cliente envia **apenas** `{ renovacaoDeId }`, o servidor localiza a original e preserva autorizador/parâmetros. Gates de perfil **antes** de instanciar o serviço.
- Novos tipos: `RenovacaoLiberacao` e `CriarLiberacaoDados` (união discriminada por `pacienteId`) em `lib/domain/liberacoes/types.ts`.
- `liberacao-form.tsx`: renovação com resumo somente-leitura (Tipo/Quantidade/Período/Vigência) + "mantém o profissional autorizador original"; campo de paciente por busca (nunca a lista completa).
- Mapeamento de erro `23503` → `VALIDACAO` "Registro relacionado não encontrado." (sem vazar nomes de tabela).

### Testes
- **15** testes de actions (renovação server-side, gates de perfil, sem `profissional_autorizador_id` do cliente).
- **19** testes de componentes (`liberacoes-view` + `liberacao-form`).
- **6** testes de integração env-guarded (`tests/integration/liberacoes.integration.test.ts`) — autorizador cria contínua (auditoria via trigger `liberacao.criada`), recepção renova preservando autorizador (`liberacao.renovada`), gestor lista/busca, recepção só vê ativas, RLS de INSERT (recepção não cria nova; inativo bloqueado), CPF nunca exposto. Cleanup em `finally` (renovação antes da original; `auditoria_logs` append-only preservado).
- Seed (`scripts/seed-test-users.mjs`) ganhou `garantirPaciente` (gestor_sus `0000000001`).

### Validação
- `npm test` — **327** testes não-auth passando; integração de liberações **6/6**; `npm run lint`, `npx tsc --noEmit` e `npm run build` OK.
- **Achado de segurança (gap)**: a policy `liberacoes_insert_autorizador` (migration 09) **não exige `renovacao_de_id is null`** — o banco aceita um autorizador inserindo com `renovacao_de_id`. Hoje "renovação somente pela recepção" é barrada na **action** (coberto por testes). Se quiser reforço no banco, criar migration que adicione a checagem à policy.
- Observação: `rls.integration.test.ts` e `supabase.integration.test.ts` podem falhar com **429 rate limit do Supabase Auth** (excesso de `signInWithPassword` na mesma janela) — transitório, sem relação com as mudanças.

## Sprint 17 — Primeiro Acesso + UX Premium Mobile-First

- **Fluxo de primeiro acesso** implementado: Landing → Login → `/primeiro-acesso` → Troca de senha → Dashboard.
- **Interface `/primeiro-acesso`** criada (page + form) com validação de senha, feedback de loading, sucesso e erro, mobile‑first premium.
- **Segurança reforçada**: senha temporária enviada somente ao Supabase Auth via `updateUser`; flag `precisa_trocar_senha` limpo via Admin API; nenhuma informação de senha expõe bundles/client.
- **Proteção de rotas**: redirects automáticos evitam acesso direto ao `/dashboard` enquanto o flag estiver ativo.
- **UX premium**: redesign mobile‑first de Landing, Login, Dashboard, Usuários, Pacientes e `/primeiro-acesso` (hierarquia visual, contrastes institucionais, touch targets ≥44 px, foco acessível, sem overflow horizontal).
- **Testes ampliados**: +18 novos testes de primeiro acesso, 266 testes da Sprint 16 permanecem passantes; todos passam lint, typecheck e build.
- **Validações de segurança**: senha mínima de 8 caracteres, confirmação obrigatória, redirect seguro (`?next=``` protegido), nenhum leak de SERVICE_ROLE ou credenciais no HTML/bundle.
- **Documentação atualizada**: changelog, roadmap e security registram a estratégia de primeiro acesso, armazenamento nulo da senha temporária e comportamento de redirect.

## Sprint 16 — Gestão e criação de usuários Auth

**Objetivo:** fechar a lacuna de provisionamento — o Gestor passa a **criar** o
usuário (Auth + vínculo em `public.usuarios`) pela UI, sem acesso direto ao
banco, usando a Admin API do Supabase **somente no servidor**. A
`SERVICE_ROLE_KEY` nunca atravessa a fronteira client/server.

### Camada server-only da Admin API
- `lib/supabase/admin.ts` — client com `SUPABASE_SERVICE_ROLE_KEY` exclusivo do
  servidor; **guard explícito** (`typeof window`) que falha em build/runtime se
  qualquer bundle client-side importar o módulo (a chave nem chegaria ao
  navegador: variáveis não-`NEXT_PUBLIC_*` não são embutidas no bundle, mas a
  falha é barulhenta); `persistSession: false`; nunca loga/retorna a chave.
- `lib/services/usuario-admin-service.ts` — caso de uso de criação completa com
  adaptador `AdminAuthAdapter` injetável (testável): `SupabaseAdminAuth` (Admin
  API real) e `gerarSenhaTemporaria()` (`randomBytes(12)` → 16 chars base64url).

### Fluxo Auth → public.usuarios (falha parcial tratada)
1. validação servidor (`validarCriacaoUsuario`: nome, e-mail+formato, RN02);
2. checagem de duplicidade em `public.usuarios` **antes** de criar o Auth
   (novo `UsuarioRepository.buscarPorEmail` — evita Auth órfão previsível);
3. geração da senha temporária (nunca gravada/logada);
4. `admin.auth.admin.createUser({ email, password, email_confirm: true })` —
   captura o **UUID real** retornado;
5. `INSERT` em `public.usuarios` com esse `auth_user_id` **pelo client do
   Gestor autenticado** (RLS `usuarios_insert_gestor` + trigger de auditoria
   registram o Gestor — NÃO usa service role para o INSERT);
6. se o vínculo falhar → **compensação**: remove o Auth recém-criado e retorna
   erro seguro ("Nenhum acesso foi mantido"); se a compensação falhar, erro
   ainda seguro ("Procure a gestão do CAPS") — Auth sem vínculo nunca fica
   enganosamente ativo.

### Decisões (registradas no relatório)
- **Gestor pode criar Gestor**: permitido nesta Sprint (RLS já autoriza); a regra
  institucional NÃO está documentada → registrada como **DECISÃO INSTITUCIONAL
  PENDENTE** (aplicar depois no domínio/servidor quando definida). Nenhuma RN nova.
- **Primeiro acesso via senha temporária exibida 1x** (sem SMTP configurado):
  o servidor gera a senha forte, o Gestor a vê **uma única vez** no sucesso e a
  entrega por canal seguro; troca obrigatória no primeiro acesso fica como
  pendência para sprint futura. Nada é salvo em `public.usuarios`, logs,
  localStorage ou URL.

### Action e UI
- `app/actions/usuarios.ts` → `criarUsuarioCompletoAction`: autorização explícita
  no servidor (`exigeGestorAtivo` — identidade + perfil + status ativo) antes de
  qualquer chamada; `auth_user_id` NUNCA vem do browser; erros normalizados
  (duplicidade Auth/"Já existe uma conta para este e-mail.", duplicidade em
  `usuarios`, genéricos sem detalhes internos).
- `app/dashboard/usuarios/components/novo-usuario-form.tsx` — dialog mobile-first
  (label, validação client e servidor, loading "Criando...", sucesso com senha
  temporária em destaque "exibida uma única vez" + botão Concluir, erro em
  `role="alert"`); campo Profissão aparece apenas para o perfil autorizador;
  acessível (`role="dialog"`, `aria-modal`, `aria-invalid`/`aria-describedby`).
- `usuarios-view.tsx` — botão **[Novo usuário]** no cabeçalho da página; ao
  concluir, fecha o formulário e faz `router.refresh()` (lista atualizada).
- `.env.example` criado com placeholders (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`
  e `TEST_*`) — sem valores reais.

### Sem alterações
- Migrations/RLS/policies (01–18) **intactas**: a criação usa a policy
  `usuarios_insert_gestor` existente; nenhuma migration nova, nenhum `db push`,
  nenhuma alteração de grants. `proxy.ts`, `lib/supabase/server|client|middleware`
  e `lib/auth/profile.ts` intocados. Sem DELETE; ativação/inativação existente
  preservada. `terminal.bat` não tocado.

### Testes (266 passando; 48 novos)
- `tests/services/usuario-admin-service.test.ts` (14) — fluxo principal (e-mail
  normalizado, UUID real, senha nunca no vínculo), validação (nome/e-mail/RN02),
  duplicidade antes do Auth, erros do Auth (mensagens seguras; inclui gotrue
  `code: "email_exists"` / "already been registered"), falha parcial e
  **compensação** (remove Auth criado; falha da compensação ainda retorna erro
  seguro), `gerarSenhaTemporaria`.
- `tests/domain/regras.test.ts` — `validarCriacaoUsuario` (obrigatórios, formato
  de e-mail, RN02).
- `tests/actions/usuarios-actions.test.ts` — autorização de `criarUsuarioCompletoAction`
  (gestor ativo OK; recepcionista/inativo/sem vínculo/sem sessão bloqueados antes
  do serviço; erros seguros sem vazar gotrue/SERVICE_ROLE).
- `tests/components/novo-usuario-form.test.tsx` (10) — campos/perfil/profissão,
  envio à action (sem `auth_user_id` do cliente), sucesso com senha 1x, validação
  client, erro, loading, cancelar, Concluir.
- `tests/components/usuarios-view.test.tsx` — botão "Novo usuário" abre o dialog;
  concluir atualiza a lista (`router.refresh`) e fecha.
- `tests/integration/usuarios-criacao.integration.test.ts` (5, env-guarded contra
  Supabase real; cleanup em `finally`) — gestor cria usuário (UUID real, senha nunca
  em `public.usuarios`), duplicidade de `usuarios` antes do Auth, duplicidade do
  Auth (`email_exists` → mensagem segura), recepcionista bloqueada pela RLS
  `usuarios_insert_gestor`, autorizador com profissão.

### Validação
- `npm test` (25 arquivos / 266 testes), `npm run lint`, `npx tsc --noEmit`,
  `npm run build` — OK (rotas idênticas às da Sprint 15).
- **Bundle client sem vazamento**: `grep` nos chunks de `.next/static` não encontra
  `SERVICE_ROLE`/`admin.ts`/`createAdminClient`/`gerarSenhaTemporaria`.
- Secret scan limpo (nenhum JWT service role/valor em código, docs, testes ou
  fixtures; apenas nomes de variáveis em comentários/placeholders).
- `git status`/`git diff` restritos ao escopo (nenhuma migration/RLS/infra).

### Pendências
- **DECISÃO INSTITUCIONAL PENDENTE:** Gestor pode criar outro Gestor?
- **Troca obrigatória de senha no primeiro acesso** (exigir a troca da senha
  temporária após o primeiro login) — infra futura.
- **Validação manual no browser** (criar autorizador/recepcionista, mensagens,
  mobile/desktop, senha 1x) — aguarda navegador humano.
- **E-mail institucional** (convite) quando SMTP for configurado.

## Sprint 15 — Dashboard UX premium, profissional e mobile-first

**Objetivo:** transformar `/dashboard` na primeira experiência real pós-login,
deixando de ser tela funcional para se tornar um Dashboard de produto — premium,
profissional, institucional, claro e mobile-first — sem tocar em infraestrutura,
banco/RLS, autorização ou fonte de verdade do perfil.

### Arquitetura
- `app/dashboard/layout.tsx` — agora monta o **shell** do painel (consulta sessão +
  `getUsuarioFuncional` e repassa perfil/status; `redirect` para `/login?next=/dashboard`
  se sem sessão — mesmo padrão dos módulos). Páginas continuam Server Components.
- `app/dashboard/page.tsx` — só resolve o usuário funcional e delega ao
  `DashboardHome`; sem `LogoutButton` (agora no shell).
- `components/dashboard/dashboard-shell.tsx` (client, apenas navegação) — header fixo
  (marca, perfil chip, e-mail), **sidebar desktop** (`lg`, cards `CARTAO`: navegação
  com item ativo via `aria-current` + borda-esquerda/cor, "Em desenvolvimento" com
  Liberações/Retiradas/Auditoria **como spans não-link**, resumo da conta + `Sair`),
  **drawer mobile** (botão "Abrir menu", `role="dialog"`; fecha por `Esc`, overlay,
  botão X, ou ao escolher um módulo) e `main.min-w-0` para o conteúdo.
- `components/dashboard/dashboard-home.tsx` (server-safe) — saudação contextual
  ("Bom dia/Boa tarde/Boa noite!") com **fallback neutro** (nome do usuário não é
  recuperável pela infra atual; nada é inventado), subtítulo "O que você precisa
  fazer hoje?", chip de perfil/estado e os blocos abaixo.
- `components/dashboard/module-card.tsx` — card-link de módulo (ícone, título,
  descrição, "Abrir").

### Navegação por perfil (rotas reais)
- Nova função pura `capacidadeDashboard()` em `lib/domain/regras.ts` (fonte da
  matriz, testável), espelhando `permissoesPacientes`/`permissoesUsuarios`:
  - **Dashboard/Pacientes**: todos os perfis ativos (leitura por `v_pacientes`).
  - **Usuários**: somente Gestor ativo (`usuarios_select/update_gestor`).
  - **Liberações/Retiradas/Auditoria**: sem página — **não há link**; aparecem apenas
    como "Em desenvolvimento" (rubrica), sem rota.
- `estadoUsuario()` também adicionada (ativo/inativo/sem-vínculo) para estados de UI.

### Dados reais utilizados (nenhuma métrica fictícia)
- Perfil e status vêm de `getUsuarioFuncional()` (`perfil_atual()`/
  `usuario_ativo_atual()`); e-mail da sessão (o próprio usuário). Nome não é exibido
  por falta de fonte (RLS só permite Gestor ler `public.usuarios`; sem RPC de nome) —
  saudação com fallback neutro registrada como pendência.
- Visão geral: perfil, situação (ativo), e-mail — sem contadores/gráficos inventados.

### Estados de interface
- Conteúdo normal; **usuário inativo** e **sem vínculo** → card "Acesso não
  configurado" com orientação segura (sem ações); `loading.tsx` (role=status) e
  `error.tsx` (retry) no painel — sem tela branca; logout compartilhado.

### Acessibilidade e mobile-first
- HTML semântico (header/nav/aside/main/section/dl), hierarquia de headings (h1
  saudação, h2 seções), `aria-current`, `aria-expanded`/`aria-controls` no toggle,
  diálogo modal acessível, `Esc` para fechar, foco visível, touch targets ≥40px,
  item ativo perceptível além de cor; animação mínima (`transition-colors`) e sem
  movimento decorativo pesado. Grid adaptável (1 → 2/3 colunas).

### Testes (218 passando; 19 novos)
- `tests/components/dashboard-home.test.tsx` (10) — saudação/fallback (sem nome
  inventado), módulos por perfil (Gestor: Pacientes+Usuários; autorizador e
  recepcionista: só Pacientes), estados inativo/sem-vínculo, **sem links para Liberações/
  Retiradas/Auditoria**, visão geral com dados reais, sem informação sensível.
- `tests/components/dashboard-shell.test.tsx` (9) — identidade/conteúdo, item ativo
  via `aria-current`, perfil na navegação, módulos planejados como não-link, logout,
  drawer mobile (abre/fecha por `Esc` e ao escolher módulo), sem info sensível.

### Validação e pendências
- `npm test` (22 arquivos / 218 testes), `npm run lint`, `npx tsc --noEmit`,
  `npm run build` — OK (rotas como antes; `/` estática, `/dashboard*` ƒ).
- Secret scan limpo; `git status`/`git diff` restritos ao escopo.
- **Não alterados**: migrations/RLS/policies/tabelas/funções/triggers (01–18
  intactos), `proxy.ts`, `lib/supabase/`, `lib/auth/profile.ts`, autorização.
- **Pendências**: validação manual no browser (5 usuários de teste × desktop/mobile)
  e recuperação do nome do usuário para saudação personalizada (RPC futura).

## Sprint 14 — UX do login + primeiro acesso

**Objetivo:** tornar o Login uma continuação natural da Landing (mesma identidade:
tipografia, paleta, botões, espaçamentos) e refinar o fluxo de autenticação **real**
existente — sem criar infraestrutura nova, sem tocar em banco/RLS/migrations e sem
antecipar Liberações. Jornada: `/` → `/login` → `/dashboard`.

### Identidade compartilhada
- `components/ui/visual-tokens.ts` (novo) — tokens de classe extraídos da Landing
  (`CONTAINER`, `BOTAO_PRIMARIO/SECUNDARIO`, `LINK`, `LINK_NAV`, `ROTULO`, `INPUT`,
  `INPUT_ERRO`). `components/landing/landing.tsx` passou a importá-los (mesmas classes,
  nenhuma mudança visual) e o Login os usa — mesma linguagem visual no produto.
- `.test.tsx`/docs atualizados; nenhuma biblioteca de UI nova.

### Página `/login` (`app/login/page.tsx`)
- Header com marca (link para `/`), cartão `rounded-lg bg-white` com pill "Sistema
  institucional", título "Entrar no sistema", descrição, formulário e CTA de retorno à
  Landing; footer institucional; `metadata` própria. Mobile-first; sem larguras fixas.

### LoginForm (`app/login/login-form.tsx`)
- Estados: formulário inicial; campos vazios; e-mail inválido; senha vazia; credenciais
  inválidas; autenticação em andamento ("Entrando...", botão `disabled`, campos
  `disabled`, `aria-busy`); erro inesperado; `?next=` preservado em campo oculto;
  sucesso via redirect; usuário já autenticado sai de `/login` pelo `proxy.ts`
  (intocado).
- Validação client com `noValidate` + mensagens próprias, associadas ao campo
  (`aria-invalid` + `aria-describedby`), limpando ao digitar.
- Show/hide de senha (botão `aria-label`/`aria-pressed` alternando `password`/`text`).
- `autocomplete="email"`/`"current-password"`; labels reais (nada de placeholder).
- Global error com `role="alert"` (aria-live assertiva) para mensagens da action.

### Autenticação (`app/actions/auth.ts`)
- `login()` mapeia erros reais para mensagens seguras e compreensíveis:
  `invalid_credentials`, `email_not_confirmed`, `over_request_rate_limit` e fallback
  genérico — sem expor SQL/Supabase/stack.
- **Correção de segurança:** `?next=` agora só aceita rotas internas (bloqueia
  `https://...`, `//host`, `/\\...`, `:`); caso contrário cai em `/dashboard`.
- Redirects preservados: sem `next` → `/dashboard`; `next` interno →
  `/dashboard/pacientes`; autenticado em `/login` → `/dashboard`.

### Dashboard (transição, mínimo)
- `app/dashboard/page.tsx` — selo "Você entrou no sistema." (indica entrada clara na
  jornada); navegação e restante inalterados. `logout-button` ganhou foco visível.

### Segurança e escopo
- **Não alterados**: `proxy.ts`, `lib/supabase/*` (server/middleware/client),
  `lib/auth/profile.ts`, banco/RLS/migrations/policies/funções (migrations 01–18
  intactas), `SERVICE_ROLE_KEY` no frontend. Nenhum cadastro público, nenhuma
  recuperação de senha fictícia, nenhum dado fictício na UI.

### Testes (199 passando; 21 novos)
- `tests/actions/auth.test.ts` — campos obrigatórios; mensagens seguras
  (invalid_credentials, e-mail não confirmado, erro inesperado sem vazar
  SQL/Supabase); redirect `/dashboard`; `?next=` interno; bloqueio de `https://` e
  `//host`; logout → `/login`.
- `tests/components/login-form.test.tsx` — renderização (labels/autocomplete/tipos);
  submit envia dados; validação (vazio, formato); limpeza de erro ao digitar; erro de
  autenticação (`role=alert`); estado de carregamento/disabled; `?next=` no campo
  oculto; CTA de retorno à Landing; show/hide senha; **sem informação sensível no
  HTML**.

### Validação
- `npm test` (20 arquivos / 199 testes), `npm run lint`, `npx tsc --noEmit`, `npm run
  build` — todos OK; `/` estática, demais rotas dinâmicas; `proxy.ts` (ƒ) registrado
  no build como antes.
- Secret scan: limpo (apenas placeholders `sua_senha`/`<senha>` em exemplos de docs/
  scripts e nomes de variáveis). `git status`/`git diff` restritos ao escopo.
- **Pendência** (browser humano): validar a jornada completa — ver pendências das
  Sprints 12–14.

## Sprint 13 — Landing page / primeira experiência

**Objetivo:** dar ao produto uma primeira página institucional em `/` que apresente o
sistema e conduza ao login, definindo a identidade visual reutilizável das próximas
páginas. Página **estática** (server component) — sem Supabase, sem autenticação, sem
fetches/polling, sem novos cadastros ou CTA "começar agora".

### Rota e componentes
- `app/page.tsx` — boilerplate do Create Next App substituído pelo `Landing` + `metadata`
  (title/description institucionais da Landing).
- `components/landing/landing.tsx` — compõe Header, Hero, `SecaoOrganiza`,
  `SecaoSeguranca`, `SecaoFluxo`, `SecaoCtaFinal` e Footer; tokens de "identidade"
  (`CONTAINER`, `BOTAO_PRIMARIO`, `BOTAO_SECUNDARIO`, `LINK_NAV`) reutilizam a paleta
  zinc/padrões do login e do dashboard (`h-11 rounded-md`, botão primário `zinc-900`,
  `max-w-5xl`, `rounded-lg`, `shadow-sm`), para adoção nas próximas páginas.
- **Seções:** Hero (título + CTA "Entrar no sistema" → `/login`), "O que o sistema
  organiza" (5 módulos: Pacientes, Liberações, Retiradas, Usuários, Auditoria — só
  capacidades já documentadas), "Controle e segurança" (acesso por perfil, usuários
  ativos, permissões no banco, auditoria, proteção de dados sensíveis), "Como o
  benefício flui" (Paciente → Liberação → Retirada), CTA final e footer (marca +
  acesso; nenhum endereço/telefone/CNPJ inventado).
- **Sem imagem de banco**: ilustração decorativa em SVG inline; ícones SVG inline nos
  módulos.

### Acessibilidade e identidade
- HTML semântico (`header`/`main`/`section`/`ol`/`footer`), heading hierarchy (h1 → h2 → h3),
  `aria-label` na navegação e nas ilustrações decorativas; tudo navegável por telhado
  (`focus-visible`) e por teclado; sem elementos clicáveis genéricos no lugar de links.
- Mobile-first: layout em coluna em telas pequenas, grades (`sm:grid-cols-2`,
  `lg:grid-cols-3`) em telas maiores; CTA e marca sempre visíveis.
- Correções globais de identidade: `body` agora usa a fonte Geist via
  `var(--font-geist-sans)` (antes sobrescrita por Arial em `app/globals.css`) e
  `lang="pt-BR"` em `app/layout.tsx`.

### Segurança e escopo
- Nada de backend: sem `SupabaseClient`, sem server actions novas, sem novas
  migrations/policies/tabelas/RLS (migrations 01–18 intactas), sem `SERVICE_ROLE_KEY`,
  sem exposição de dados (CPF, senhas, credenciais) ou de variáveis de ambiente na
  página. Login e dashboard não foram alterados (apenas `lang`/fonte globais).

### Testes (178 passando; 8 novos)
- `tests/components/landing.test.tsx` (novo) — renderiza marca/título; CTA
  "Entrar no sistema" (≥3) todos apontando para `/login`; seções institucionais
  presentes; 5 pilares dos módulos; fluxo Paciente → Liberação → Retirada; **nenhuma
  informação sensível** (sem `SERVICE_ROLE|auth.users|.env|postgres|supabase.co`);
  sem cadastro público/CTA de download; navegação semântica com âncoras internas.

### Validação
- `npm test` (18 arquivos / 178 testes), `npm run lint`, `npx tsc --noEmit`, `npm run
  build` — OK; build mostra `/` **estática** (prerendered) e demais rotas dinâmicas.
- Secret scan: nenhuma credencial/valor real em arquivos versionados (apenas nomes de
  variáveis em docs/scripts). `git status`/`git diff` revisados — apenas os arquivos
  esperados alterados/criados.
- **Pendência** (browser humano): validar manualmente a Landing (âncoras, CTA, layout
  mobile/menor) — ver pendências das Sprints 12/13.

## Sprint 12 — Página de usuários + gestão de perfil/status

**Objetivo:** página `/dashboard/usuarios` exclusiva do Gestor ativo, usando a
infraestrutura das Sprints 08–11.1 (perfil/status via `perfil_atual()`/
`usuario_ativo_atual()`; banco/RLS como autoridade). Nenhuma tela de
liberações/retiradas.

### Rotas e componentes
- `app/dashboard/usuarios/page.tsx` — Server Component: sessão real (`getUser()` +
  redirect p/ login), gate `permissoesUsuarios()` (espelha `usuarios_select/update_gestor`),
  pesquisa `?q=` sanitizada e carregamento via `listarUsuariosAction`.
  Autorizador/recepcionista/inativo/sem-vínculo recebem "Acesso restrito" (sem consulta).
- `app/dashboard/usuarios/loading.tsx` e `error.tsx` — estados de carregamento e erro.
- `app/dashboard/usuarios/components/usuarios-view.tsx` — cliente: tabela (nome, e-mail,
  perfil, profissão, status, ações), busca GET, estados vazio/sucesso/erro/salvando,
  alternância de status com `useTransition` + `router.refresh()`.
- `app/dashboard/usuarios/components/usuario-status.tsx` — badge ATIVO/INATIVO.
- `app/dashboard/layout.tsx` — link "Usuários" na navegação.

### Listagem e pesquisa (usando a camada existente)
- `lib/repositories/usuario-repository.ts` — `listar(busca?)` consulta `public.usuarios`
  (policy `usuarios_select_gestor`); busca `nome.ilike`/`email.ilike` com termo
  sanitizado por `normalizarBusca()` (mesmo padrão de Pacientes).
- `lib/services/usuario-service.ts` — `listarUsuarios(busca?)` repassa ao repositório.
- Nenhuma coluna interna de autenticação é exibida (`auth_user_id`, tokens, senhas); CPF
  de pacientes não tem relação com a tela.

### Operações
- **Alteração de status (ativo ↔ inativo):** somente Gestor ativo, via
  `ativarUsuarioAction`/`inativarUsuarioAction` → `UsuarioService` → repositório
  (`UPDATE status_ativo`; nunca exclusão física — policy `usuarios_delete_gestor` inerte
  pelo revoke de DELETE da migration 15).
- **Perfil: SOMENTE LEITURA** — regra da Sprint 08 preservada (repository não muta perfil
  na UI); nenhum controle de edição de perfil foi adicionado.
- **Criação de `auth.users`: PENDÊNCIA** — nenhum fluxo seguro definido fora do browser
  (Admin API/`SERVICE_ROLE_KEY` proibidos no cliente); sem botão "novo usuário".

### Segurança
- Server actions (`app/actions/usuarios.ts`) agora: (1) autorizam explicitamente o Gestor
  ativo no servidor (sessão + `getUsuarioFuncional`, sem duplicar autoridade — RLS
  continua o mecanismo final); (2) usam `mensagemDaAcao` (apenas `AppError` é exibido;
  erros desconhecidos viram "Ocorreu um erro inesperado" — antes qualquer `message`
  vazava). Sem `SERVICE_ROLE_KEY`, sem senha, sem mutação direta no componente.
- Nenhuma migration/policy/triggers/função/views foi alterada (migrations 01–18 intactas).

### Testes (170 passando; inclui integração real com `TEST_*`)
- `tests/domain/regras.test.ts` — `permissoesUsuarios` (gestor ativo; demais perfis,
  inativo, sem perfil bloqueados).
- `tests/repositories/usuario-repository.test.ts` (novo) — listagem, busca sanitizada
  (sem vazar `%`/`_`), status, erros → `AppError`.
- `tests/services/usuario-service.test.ts` — delegação da busca.
- `tests/actions/usuarios-actions.test.ts` (novo) — autorização de gestor, bloqueio de
  recepcionista/inativo/sem-vínculo/sem-sessão, não-vazamento de SQL, mensagens seguras.
- `tests/components/usuarios-view.test.tsx` (novo) — lista, rótulos, vazio/pesquisa/erro,
  Inativar/Reativar, feedback de erro.
- `tests/integration/rls.integration.test.ts` — novos casos reais: gestor ativo lista
  `public.usuarios`; autorizador/recepcionista/inativo/sem-vínculo retornam **0 linhas**
  (RLS continua autoridade). Rodados com os usuários de teste provisionados.

### Validação
`npm test` ✅ (170) · `npm run lint` ✅ · `tsc --noEmit` ✅ · `next build` ✅ (rota
`/dashboard/usuarios` incluída).

### Pendências
- **Teste manual no browser** dos 5 cenários (Gestor lista/alterna status; autorizador,
  recepcionista, inativo e sem-vínculo bloqueados em `/dashboard/usuarios`) — não
  executado pelo agente por não operar navegador. Dados de teste provisionados.
- **Criação de usuários Auth** (Admin API/invite fora do browser) — decisão para Sprint 13.

## Sprint 11.1 — Fechamento da integração real (fonte definitiva de perfil/status)

**Objetivo:** eliminar a dependência provisória de `user_metadata` e fechar a
integração real com o Supabase já configurado nas sprints anteriores (migrations
01–15 aplicadas pelo usuário; RLS/grantes/triggers/funções **inalterados**).

### Fonte definitiva de perfil/status
- `lib/auth/profile.ts`: removidas `getPerfilDaMeta()` e `getStatusAtivoDaMeta()`
  (leitura de `user_metadata`). Agora `getUsuarioFuncional()` é `async` e resolve
  perfil/status usando a infraestrutura existente do banco:
  - `perfil_atual()` (`security definer`, grant a `authenticated` desde a migração 10);
  - `usuario_ativo_atual()` (`security definer`, idem).
- **Sem segunda fonte de verdade** e **sem duplicação da lógica no front**: a autoridade
  permanece 100% no banco (funções `security definer` + RLS/triggers). Removido
  qualquer fallback silencioso para `user_metadata`.
- Chamadores atualizados para a assinatura async: `app/dashboard/page.tsx` e
  `app/dashboard/pacientes/page.tsx` (a página já obtém perfil/status da fonte
  definitiva — sem bypass de RLS).

### Migration 16 — avaliada e **descartada**
- Foi considerado criar `usuarios_select_proprio` (policy de leitura do próprio
  registro em `public.usuarios`) para a app ler perfil/status direto da tabela.
- **Motivo da não-criação**: as funções `perfil_atual()`/`usuario_ativo_atual()`
  (já sancionadas nas migrations 07/10) cumprem exatamente esse papel sem
  alterar o modelo de segurança. Criar policy nova desnecessária contradiria a
  regra de não alterar RLS sem necessidade real.
- **Resultado**: nenhuma migration nova; migrations 01–15 permanecem intocadas.

### Usuários de teste (seed separado de migrations)
- `scripts/seed-test-users.mjs` — provisionamento **somente dev**, idempotente:
  - cria/atualiza usuários em `auth.users` **apenas via Admin API** (sem SQL em
    estruturas internas do Auth) e insere o vínculo em `public.usuarios`;
  - exige `--confirm` (default é simulação) e **nunca imprime senhas**;
  - senhas provisórias vivem **somente** em variáveis `TEST_*` do `.env.local`
    (gitignored); nada de senha em migration, tabela ou commit;
  - cenários: gestor ativo, profissional_autorizador ativa, recepcionista ativa,
    usuária inativa e usuário autenticado **sem vínculo** (intencionalmente sem
    linha em `usuarios`).
- Procedimento documentado em `scripts/README.md` (variáveis, execução, validação).

### Testes
- `tests/profile.test.ts` reescrito para a fonte definitiva (RPCs mockadas)
  — perfil/status, usuário nulo, sem vínculo, perfil fora do enum, propagação de
  erro como `AppError`.
- `tests/integration/rls.integration.test.ts` **inalterado** — já exercita RLS
  real para anon/gestor/autorizador/recepcionista/inativo/sem-vínculo e é pulado
  enquanto as `TEST_*` não existirem no `.env.local`.
- Executados nesta sprint: `npm test` (116 passando + 14 skipped de integração),
  `npm run lint`, `tsc --noEmit`, `next build`.

### Pendências que exigem execução manual do usuário
- Adicionar `SUPABASE_SERVICE_ROLE_KEY` (somente provisionamento) e os pares
  `TEST_*_EMAIL/PASSWORD` ao `.env.local` (não pedimos a senha aqui).
- Rodar `node --env-file=.env.local scripts/seed-test-users.mjs --confirm`.
- Rodar `npm test` com as `TEST_*` presentes para ativar os blocos de integração.
- Validação real com usuários autenticados no browser (login + navegação) — não
  executada pelo agente por não operar navegador.

## Sprint 11 — Primeira página de negócio: Pacientes

**Objetivo:** entregar o primeiro fluxo completo de negócio (`UI → Server Action → Service → Repository → Supabase → RLS/triggers/auditoria`) em `/dashboard/pacientes`.

### Rotas e componentes
- `app/dashboard/layout.tsx` — barra superior mínima (título, link Pacientes, logout) reutilizada pelo dashboard.
- `app/dashboard/pacientes/page.tsx` — Server Component com autenticação real (`getUser()` + redirect para `/login?next=...`), gate de perfil/status (usuário inativo/sem perfil não consulta dados) e carregamento inicial via `listarPacientesAction`.
- `app/dashboard/pacientes/loading.tsx` e `error.tsx` — estados de carregamento e erro sem tela branca.
- `components/pacientes-view.tsx` — cliente: pesquisa (GET com `?q=`), lista responsiva, estados vazio/erro, ações por perfil, alteração de status com `useTransition`.
- `components/paciente-form.tsx` — formulário criar/editar via `useActionState` (estados salvando/sucesso/erro); edição não altera Gestor SUS (RN25) nem CPF/status.
- `components/paciente-status.tsx` — badge ATIVO/INATIVO usando `STATUS_PACIENTE` canônico.

### Permissões de UI (derivadas da RLS; o banco permanece a autoridade)
| Perfil | Ler | Criar | Editar dados | Alterar status |
|---|---|---|---|---|
| Profissional autorizador (ativo) | ✅ | ✅ | ✅ | ❌ (trigger bloqueia) |
| Gestor (ativo) | ✅ | ❌ (sem policy de INSERT) | ❌ (trigger: só status) | ✅ |
| Recepcionista (ativa) | ✅ | ❌ | ❌ | ❌ |
| Inativo / sem perfil | ❌ | ❌ | ❌ | ❌ |

### Camada de dados/regras
- `lib/domain/regras.ts` — nova `permissoesPacientes(perfil, statusAtivo)` (política de UI espelhando a RLS).
- `lib/domain/app-error.ts` — mapeamentos de `23505` (unicidade → "Já existe um paciente com este Gestor SUS (ou CPF).") e `23514` (check constraint).
- `lib/repositories/paciente-repository.ts` — `listar(busca?)` com `ilike` em `nome`/`gestor_sus` via `v_pacientes` (nunca CPF); `normalizarBusca()` sanitiza o termo.
- `lib/services/paciente-service.ts` e `app/actions/pacientes.ts` — repasse da busca; actions só expõem mensagens de `AppError` (erros desconhecidos → mensagem genérica; nunca SQLSTATE/stack/RLS).

### Testes (118 passando + 14 skipped de integração)
- `tests/domain/regras.test.ts` — casos de `permissoesPacientes`.
- `tests/errors/app-error.test.ts` — casos `23505`/`23514`.
- `tests/repositories/paciente-repository.test.ts` — busca com filtro sanitizado.
- `tests/services/paciente-service.test.ts` — repasse da busca.
- `tests/actions/pacientes-actions.test.ts` — listar/criar/atualizar + não-vazamento de SQL.
- `tests/components/pacientes-view.test.tsx` e `paciente-form.test.tsx` (React Testing Library/jsdom) — leitura, pesquisa, vazio, erro, permissões por perfil, CPF ausente na listagem, abertura de formulários, alteração de status.
- Infra: `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` instalados; `tests/setup.ts`; `vitest.config.mts` com `setupFiles`.

### Segurança (respeitadas)
- Nenhuma migration alterada; sem `service_role`; sem bypass de RLS; sem SELECT direto de CPF (só `v_pacientes`/RPC); sem escrita em `auditoria_logs` (triggers geram); sem DELETE de paciente; autorização de UI apenas melhorando a UX.

### Limitações e pendências
- Gestor não cadastra nem edita dados de paciente (RLS atual: INSERT só autorizador; trigger bloqueia edição de dados pelo gestor). Alteração de status é o único caminho do gestor.
- CPF: opcional no cadastro (autorizador); **não** editável (sem leitura segura para preencher); edição/obrigatoriedade do CPF pendentes (decisão institucional — Sprint 05).
- `unidade_id` não é exibido (módulo `unidades` inexistente no schema).
- Pesquisa sem paginação (volume atual baixo); evolução documentada no ROADMAP.

## Sprint 08 — Camada de domínio, repositórios, serviços e testes

**Objetivo:** preparar a lógica de negócio e o acesso a dados antes de qualquer UI, mantendo o banco (RLS + triggers) como autoridade.

### Novos módulos (`lib/`)
- **`lib/domain/enums.ts`** — enums canônicos do domínio (`PERFIS`, `PROFISSOES`, `STATUS_PACIENTE`, `STATUS_USUARIO`, `TIPOS_LIBERACAO`, `TIPOS_RETIRADA`, `TIPOS_EVENTO_AUDITORIA`). `lib/auth/profile.ts` passou a reutilizá-los (sem duplicação).
- **`lib/domain/entities.ts`** — tipos base das entidades.
- **`lib/domain/{pacientes,usuarios,liberacoes,retiradas,auditoria}/types.ts`** — tipos de cada entidade e de criação/atualização.
- **`lib/domain/app-error.ts`** — `AppError` com códigos tipados (`VALIDACAO`, `PERMISSAO`, `CONFLITO`, `NAO_ENCONTRADO`, `INATIVO`, `SALDO`, `NAO_AUTORIZADO`, `INTERNO`).
- **`lib/domain/regras.ts`** — constantes RN01–RN28 e validações (novo paciente, novo usuário, liberação, retirada, renovação) com mensagens claras.

### Repositórios (`lib/repositories/`)
- `PacienteRepositoryPostgres` — CRUD via `pacientes` + `v_pacientes` (sem coluna `cpf`); CPF **somente** via RPC `pacientes_com_cpf()` (gate de gestor ativo).
- `UsuarioRepositoryPostgres` — leitura/registro de `usuarios`; sem mutação de perfil/status (banco é a autoridade).
- `LiberacaoRepositoryPostgres` — criação e listagem de liberações; **sem update/delete**.
- `RetiradaRepositoryPostgres` — registro e listagem de retiradas; **sem update/delete**.

### Serviços (`lib/services/`)
- `PacienteService`, `UsuarioService`, `LiberacaoService`, `RetiradaService` — casos de uso que validam antes do banco e delegam ao repositório. Não expõem operações proibidas (ex.: update/delete de liberação/retirada).

### Server actions mínimas (`app/actions/`)
- Fluxo UI → action → service → repository já conectável (perfil/status via `lib/auth/profile.ts`).

### Testes
- **Unitários (84 passando):** `tests/domain/regras.test.ts`, `tests/errors/app-error.test.ts`, `tests/services/*`, `tests/repositories/*` (com client mockado), além dos pré-existentes.
- **Integração (env-guarded)** em `tests/integration/`: RLS por perfil, proteção do CPF (coluna + RPC), auditoria append-only e concorrência de retiradas. Requerem `TEST_SUPABASE_URL`, `TEST_ANON_KEY`, `TEST_*_EMAIL/SENHA` (projeto de teste dedicado); pulados automaticamente sem as variáveis.
- **Checklist:** `npm test` ✅ · `npm run lint` ✅ · `tsc --noEmit` ✅ · `next build` ✅.

### Notas
- Migrations (Sprint 07) ainda **não aplicadas** ao Supabase; os testes de integração pendentes do `db push`.
- Nenhuma UI de negócio foi criada nesta sprint.

## Sprint 07 — Schema físico no Supabase (migrations)

- 10 migrations criadas em `supabase/migrations/`: enums, `pacientes`, `usuarios`, `liberacoes`, `retiradas`, `auditoria_logs`, funções (`auth_uid`, `auth_perfil`), triggers de auditoria/liberação, `v_pacientes`, `v_liberacoes`, RLS de menor privilégio e grants.
- Decisões técnicas: somas como `bigint`; campos de sessão setados somente em INSERT; update em `pacientes` só pelo Gestor e somente de status; revokes de mutação em `auditoria_logs`.
- **Aplicável via CLI; nenhuma migration aplicada ainda.**

## Sprint 06.1 — Validação final do Auth

- Chave padronizada para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Publishable Key).
- Reconhecimento de usuário funcional (perfil/status) preparado em `lib/auth/profile.ts`.
- Login real validado (login, sessão, `/dashboard`, logout, bloqueio pós-logout, redirect de não autenticados).
- Vitest, lint, typecheck e build passando.

## Sprint 06 — Integração Supabase Auth

- `.env.local`, clientes `@supabase/ssr` (browser/server/middleware), `proxy.ts` (Next 16) protegendo `/dashboard`.
- Tela de login mínima com Server Actions (`useActionState`); logout.
- Vitest 4 instalado/configurado; validação de conexão com o Supabase.

## Sprints 00–05 — Documentação e modelagem

- Visão, domínio, arquitetura, banco, segurança, auditoria, relatórios e roadmap em `docs/`.
- Regras RN01–RN28 formalizadas; decisões institucionais validadas (liberação contínua/avulsa, renovação pela recepção, retirada pelo paciente, Gestor SUS + CPF, auditoria com distinção de papéis).
- Modelagem conceitual e lógica definitivas em `DATABASE.md`.
