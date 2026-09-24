# Checklist de release — Vale Transporte CAPS

> Operacional, sem secrets. Ordem de execução importa. PROD somente com
> autorização explícita. Referência: `supabase/migrations/` (30 arquivos).

## 0. Pré-condições

- [ ] HEAD testado: suíte verde, lint 0 errors, build OK.
- [ ] Responsável pelo restore definido; backup PROD confirmado.
- [ ] Credenciais de DBA (SQL Editor PROD) e Vercel disponíveis.

## 1. Backup PROD (antes de tudo)

- [ ] Snapshot/backup automático confirmado no dashboard (projeto `asirrtudqukpwimtrrhi`).
- [ ] Retenção e procedimento de restore conhecidos.

## 2. Migrations PROD (SQL Editor, nesta ordem quando pendentes)

Críticas (funcionalidade validada em DEV):

- [ ] `20260903000001` — `vales_por_dia` (aditiva, `IF NOT EXISTS`).
- [ ] `20260826000001` — `fn_retiradas_before` RN31 (remove teto de saldo).
- [ ] `20260902000001` + `20260902000002` — matriz RLS Sprint 44/44-fix (**ordem importa**).
- [ ] `20260904000001` — RLS recepcionista (`avulsa OR renovacao NOT NULL`).
- [ ] Demais pendentes de `supabase/migrations/` em ordem cronológica (nenhuma contém DML de dados).

Após cada bloco, conferir no SQL Editor:

```sql
SELECT pg_get_functiondef('public.fn_retiradas_before()'::regprocedure);
-- NÃO deve conter "restante" nem "excede a quantidade".

SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'liberacoes' AND policyname LIKE '%recepcionista%';
```

## 3. Validação pós-migration (comportamental, dados H*_ descartáveis)

- [ ] Recepcionista + contínua nova → negado (42501).
- [ ] Esporádico + contínua → negado (RN29).
- [ ] Retirada acima da previsão → permitida, diferença negativa.
- [ ] Retirada fora da vigência → negada (RN13/RN21).
- [ ] Remover linhas de teste (nunca apagar `auditoria_logs`).

## 4. Usuários PROD (shell com ENV de PROD, nunca DEV)

- [ ] `node scripts/provision-real-users.mjs --check` (simulação).
- [ ] `node scripts/provision-real-users.mjs --confirm` (gestor + recepcionista).
- [ ] Autorizador: criar via `/dashboard/usuarios` (gestor) ou convite manual.
- [ ] Convites aceitos; login validado por perfil.
- [ ] Supabase Auth > URL Configuration: `Site URL` = domínio PROD; Redirect URLs incluem o domínio (o app não tem rota `/auth/callback`; convites usam o Site URL).
- [ ] SMTP/templates de invite conferidos. Sem fluxo "esqueci senha" (decisão pendente).

## 5. Vercel Production

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = PROD; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = PROD.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = PROD, somente server (nunca `NEXT_PUBLIC_*`, nunca TEST_*).
- [ ] Deploy a partir de `main`; smoke pós-deploy (login 3 perfis, atendimento, liberação, retirada, relatório).

## 6. Rollback

- App: revert do commit + redeploy Vercel.
- Banco: functions/policies são `CREATE OR REPLACE` / `DROP IF EXISTS + CREATE` — rollback = reaplicar o conteúdo anterior versionado em Git. Sem restore documentado, não há rollback de dados além do backup da etapa 1.
- Critério: qualquer FALHA na etapa 3 ou 5 → parar e avaliar restore antes de prosseguir.
