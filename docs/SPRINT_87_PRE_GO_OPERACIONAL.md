# Sprint 87 — Pré-Go Operacional

Data (UTC): 2026-09-28.
Natureza: diagnóstico e preparação. Nenhuma alteração em código funcional,
banco PROD, dados, secrets, Vercel ou deploy.

## 1. Baseline

- HEAD: `6628f1f docs: add production release checklist`
- Branch: `main` — 15 commits à frente de `origin/main`, 0 atrás
- Git status: `nothing to commit, working tree clean` (antes, durante e depois)
- Testes: 64 files, **815 passed / 0 failed / 0 skipped**
- Lint: **0 errors / 12 warnings**
- Build: OK, 14 rotas (`/`, `/_not-found`, `/dashboard` + 7 sub-rotas,
  `/login`, `/primeiro-acesso` + middleware)
- Nenhum problema novo encontrado nesta etapa; nada foi corrigido
  (nada havia para corrigir no baseline).

## 2. Supabase PROD

- Projeto: `asirrtudqukpwimtrrhi` (host confirmado via `.env.production.local`;
  DEV `vwqszdvgmaqjfpeqkmcx` intocado em `.env.local`)
- Conectividade (somente leitura): Auth `/auth/v1/health` HTTP 200 com
  publishable; sem key HTTP 401 (exige autenticação)
- REST via service_role (`select=id&limit=0`, só contagens, sem PII):
  pacientes=4, liberacoes=1, retiradas=1, usuarios=4, auditoria_logs=20
  (idêntico ao Sprint 85 — nenhuma mudança inesperada de volume)
- REST anônimo: HTTP 401 / code 42501 nas tabelas (causa provável mapeada
  no Sprint 84.2: grants do role anônimo; não corrigido, por escopo)
- Estado conhecido da auditoria SQL manual (Sprint 86, evidência direta no
  PostgreSQL 17.6): RLS habilitado nas tabelas principais; policies por
  perfil presentes; triggers críticos habilitados (`trg_liberacoes_before`,
  `trg_retiradas_before`, auditorias, `trg_auditoria_imutavel`);
  functions presentes (`fn_liberacoes_before`, `fn_retiradas_before`, …);
  RN29/RN31/vigência/RN24 confirmadas nas definitions; `v_pacientes` sem CPF;
  `pacientes_com_cpf` restrito a gestor ativo; `vales_por_dia` presente;
  auditoria append-only; última migration registrada `20260903000001`
- Observações: nenhum erro de configuração evidente; nenhum secret exposto;
  nada modificado.

## 3. Vercel

- Status: **não acessível com as credenciais disponíveis**
- Projeto / organização / Git Integration / branch de produção / último
  deploy / status / domínio / envs de Production: **não verificados**
  (sem `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID` em sessão ou arquivos, sem CLI;
  única vinculação é `.vercel/project.json` local com orgId/projectId, sem token)
- Deploy usa o commit esperado: **não confirmado**
- Blockers: acesso read-only à Vercel (token ou sessão Dashboard) pendente;
  verificação manual via navegador registrada como pendência operacional
- Nenhum deploy executado

## 4. Backup/PITR

- Status: **não verificado** (exige Supabase Dashboard; sem acesso pelo
  tooling local e sem contorno tentado)
- Evidência: nenhuma (backup, PITR, retenção, procedimento de restore e
  responsável operacional seguem desconhecidos)
- Blocker: **P0** — sem recuperação comprovada não há GO de produção
- Nada executado: nenhum restore, nenhuma alteração de configuração

## 5. Browser

- Tooling: Chrome desktop disponível; **sem Playwright/Puppeteer**
  (não instalados — sem autorização para ferramenta pesada)
- Smoke automatizado em browser: **não executado** (BLOCKED)
- Fluxos funcionais (validados pela suíte automatizada em DEV, 815 testes
  verdes; PROD sem mutação, por escopo):

| Fluxo | Status | Evidência |
|---|---|---|
| F01 regular + contínua | PASS (DEV) | `liberacoes.integration` |
| F02 regular + avulsa | PASS (DEV) | `liberacoes.integration` |
| F03 esporádico + avulsa + retirada | PASS (DEV) | `liberacoes.integration` (RN29 avulsa), `retiradas.integration` |
| F04 esporádico + contínua bloqueado | PASS (DEV) | trigger RN29 (`liberacoes.integration:675`), `sprint47`, service, form + trigger confirmado em PROD (SQL) |
| F05 recepção + nova contínua bloqueado | PASS (DEV) | RLS Sprint 76 (`liberacoes.integration:619`) + policy confirmada em PROD (SQL) |
| F06 contínua + retirada | PASS (DEV) | `retiradas.integration` |
| F07 retirada acima da previsão permitida | PASS (DEV) | `retiradas.integration:256` (retirado > previsto válido), `retirada-form`, `liberacoes-previsao` + trigger confirmado em PROD (SQL) |
| F08 retirada fora da vigência bloqueada | PASS (DEV, unit) | mensagens/erro RN13-RN21 (unit) + trigger confirmado em PROD (SQL); sem teste de integração dedicado |
| F09 histórico | PASS (DEV) | `relatorios-historico`, `relatorio-repository` |
| F10 relatórios | PASS (DEV) | `relatorios.integration` |

- Responsividade desktop/mobile (login, atendimento, liberações, retiradas,
  histórico, relatórios): **BLOCKED** — sem browser automatizado; observar
  overflow, modais, PatientSearch, cards e tabelas quando houver tooling

## 6. Segurança

- Secrets no Git: **nenhum** (0 `.env` versionados; scan de JWT hardcoded: 0)
- `SUPABASE_SERVICE_ROLE_KEY` somente server-side (`lib/supabase/admin.ts`,
  com guarda explícita; nenhum import de `supabase/admin` em
  `app/`/`components/`)
- `TEST_*` ausentes em `app|lib|components` (só scripts/testes)
- URLs `supabase.co` hardcoded em `app|lib|components`: nenhuma
- `console.log` de secrets em `app|lib`: nenhum
- Resultado: **CONFIRMADO** (inspeção; nenhum valor impresso ou commitado)

## 7. Pendências

- **P0**
  - P0-1 Backup/PITR/restore de PROD não verificados (sem Dashboard)
  - P0-2 RLS/triggers/RN29/RN31 dependem da auditoria SQL manual já feita;
    revalidação exigida se qualquer migration futura for aplicada
- **P1**
  - P1-1 Vercel: projeto/deploy de Production/dominio/envs não confirmados
  - P1-2 Smoke em browser (desktop + mobile) e responsividade não executados
- **P2**
  - P2-1 REST anônimo 401 (grants do role anon; confirmação no Dashboard pendente)
  - P2-2 `supabase` CLI / `psql` ausentes no ambiente local
- **P3**
  - P3-1 Nomes esperados no spec (`data_nascimento`, `autorizado_por_id`)
    divergem do modelo real (sem impacto operacional; alinhar docs)

## 8. Gate

**NO-GO**

Critério exclusivamente evidencial: embora baseline, schema PROD, regras
críticas (RN29/RN31/vigência/RLS recepção) e segurança estejam confirmados, e
os fluxos F01–F10 passem em DEV, restam **não confirmados** backup/PITR (P0),
Vercel/Production (P1) e smoke de browser (P1). "Não verificado" não é "OK".
Próxima etapa destrava com: Dashboard (backup + Vercel por leitura manual),
browser automation para smoke/responsividade e revalidação SQL pós-qualquer
mudança futura.
