# Validação do Banco Supabase — Sprint 09

Script de **somente leitura** para comparar o banco real do projeto
`vwqszdvgmaqjfpeqkmcx` (Vale Transporte CAPS) com a documentação
(`docs/DATABASE.md`, `docs/SECURITY.md`, `docs/AUDIT.md`, `docs/DOMAIN.md`).

## O que o script valida

| Seção | Validação |
|---|---|
| 1 | Tabelas esperadas em `public` (`pacientes`, `usuarios`, `liberacoes`, `retiradas`, `auditoria_logs`) |
| 2 | Colunas por tabela (tipo, nullable, default) |
| 3 | Primary keys |
| 4 | Foreign keys (tabela/coluna de referência, regras ON DELETE/UPDATE) |
| 5 | Constraints UNIQUE + índices únicos (inclui parcial: `cpf WHERE cpf IS NOT NULL`) |
| 6 | CHECK constraints (definição real) |
| 7 | Índices não únicos |
| 8 | Enums customizados e seus valores |
| 9 | Funções em `public` (retorno, idioma, volatility, security definer) |
| 10 | Triggers (nome, tabela, definição) |
| 11 | Views + opções de segurança (`security_invoker`) + definição |
| 12 | RLS habilitado por tabela (`relrowsecurity`) |
| 13 | Policies RLS (nome, comando, papéis, USING/WITH CHECK) |
| 14 | Grants/revokes de tabelas e colunas (inclui privilégio da coluna `cpf`) |
| 15 | Execute em funções por role |
| 16 | Relação `auth.users` → `public.usuarios` (vínculos e pendências) |
| 17 | Segurança do CPF (grants diretos, `v_pacientes` sem CPF, função `pacientes_com_cpf()`) |
| 18 | Auditoria (funções `fn_auditoria`/`fn_auditoria_imutavel`, triggers de audit, append-only) |
| 19 | Integridade das regras de domínio (quantidade 1/2/4/8, contínua 1/3/6, avulsa 1 dia, validade, triggers RN01/RN02/RN14/RN22/RN24/RN27) |
| 20 | Resumo de contagens (sanity check) |

## Garantias

- **Somente `SELECT`** sobre catálogos do PostgreSQL (`information_schema`, `pg_catalog`).
- **Não** cria/remove objetos.
- **Não** insere/altera/apaga dados.
- **Não** contém senhas, tokens ou credenciais.
- **Não** exige `SERVICE_ROLE_KEY` (a conexão usa o usuário `postgres` com a senha do banco).

## Como executar

### Pré-requisito

Senha do banco obtida em: **Supabase Dashboard → Projeto `vwqszdvgmaqjfpeqkmcx` → Settings → Database → Connection string**.

### Opção A — Supabase CLI (`db query`)

```powershell
$env:SUPABASE_DB_PASSWORD = "sua_senha_do_banco"

# URL-encode da senha (se houver caracteres especiais). Exemplo simples:
$url = "postgresql://postgres.vwqszdvgmaqjfpeqkmcx:${env:SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

npx.cmd --yes supabase@latest db query --db-url $url --file scripts/validate-supabase.sql
```

> Se a senha tiver caracteres como `@ : / $ { }`, é necessário percent-encode:
> `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `$` → `%24`, `{` → `%7B`, `}` → `%7D`.

### Opção B — psql (se instalado)

```powershell
psql "postgresql://postgres.vwqszdvgmaqjfpeqkmcx:sua_senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f scripts/validate-supabase.sql
```

### Opção C — Dashboard → SQL Editor

1. Abrir o projeto no dashboard.
2. **SQL Editor → New query**.
3. Colar o conteúdo de `scripts/validate-supabase.sql`.
4. **Run**.

## Resultado esperado

- Seções 1–20 exibem o **estado real** do banco.
- Comparação manual com a documentação (tabela "docs × banco" ao final do relatório da Sprint 09):
  - **OK** — igual à documentação.
  - **Divergente** — difere; reportar na Sprint 09 (não corrigir automaticamente).
  - **Pendente de teste** — requer usuários reais de cada perfil (não criados automaticamente).

### Pontos-chave a conferir no resultado

1. **RLS:** todas as 5 tabelas com `rls_habilitado = true`.
2. **Policies:** 15 policies conforme `20260811000009_rls.sql`.
3. **CPF:** coluna `cpf` **sem** `SELECT` para `anon`/`authenticated`; `v_pacientes` sem CPF na definição; `pacientes_com_cpf()` filtrando por gestor + ativo.
4. **Auditoria:** `auditoria_logs` sem INSERT/UPDATE/DELETE para `authenticated`; triggers `trg_*_audit` e `trg_auditoria_imutavel` presentes.
5. **Integridade:** CHECKs de quantidade/periodo/data_fim presentes e triggers `fn_liberacoes_before`/`fn_retiradas_before` existentes.
6. **Views:** `v_pacientes` com `security_invoker=true`; **sem** `v_pacientes_com_cpf` (substituída pela função).

---

# Seed de usuários de teste — Sprint 11.1

Provisiona os 5 usuários de teste (staff ativos + inativo + sem vínculo) usados
pela validação real (testes de integração e testes manuais no browser).

## Regras do seed

- **Sem migrations**: o provisionamento fica fora das migrations estruturais.
- **Sem SQL em `auth.users`**: os usuários são criados/atualizados somente pelo
  Supabase **Admin API** (padrão do framework).
- **Service role usada apenas neste script** de provisionamento (nunca no código
  da aplicação — a app usa URL pública + publishable key + RLS).
- **Nenhuma senha** é impressa, gravada no banco ou commitada inadequadamente:
  elas vivem apenas nas variáveis `TEST_*` do `.env.local` (gitignored).

## Variáveis exigidas (.env.local)

Novas chaves (as `NEXT_PUBLIC_*` já existem). `SUPABASE_SERVICE_ROLE_KEY` é só
para este provisionamento e pode ser removida depois:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard → Settings → API → service_role (NUNCA no app)

TEST_GESTOR_EMAIL=...           # ex.: gestor.teste.caps@example.com
TEST_GESTOR_PASSWORD=...
TEST_AUTORIZADOR_EMAIL=...
TEST_AUTORIZADOR_PASSWORD=...
TEST_RECEPCIONISTA_EMAIL=...
TEST_RECEPCIONISTA_PASSWORD=...
TEST_INATIVO_EMAIL=...
TEST_INATIVO_PASSWORD=...
TEST_SEM_VINCULO_EMAIL=...
TEST_SEM_VINCULO_PASSWORD=...
```

Perfis provisionados em `public.usuarios` conforme a tabela abaixo (o vínculo
`auth_user_id` é preenchido automaticamente a partir do usuário criado):

| Perfil do env | `perfil` em usuarios | `status_ativo` | `profissao` | Registro em `usuarios` |
|---|---|---|---|---|
| GESTOR | gestor | true | — | sim |
| AUTORIZADOR | profissional_autorizador | true | psicologo (CHECk exige) | sim |
| RECEPCIONISTA | recepcionista | true | — | sim |
| INATIVO | recepcionista | false | — | sim |
| SEM_VINCULO | — | — | — | **não** (cenário sem vínculo) |

## Executar (PowerShell)

Simulação primeiro (não altera nada):

```powershell
node --env-file=.env.local scripts/seed-test-users.mjs --check
```

Aplicar:

```powershell
node --env-file=.env.local scripts/seed-test-users.mjs --confirm
```

O script é idempotente: atualiza senha/status no re-run sem duplicar linhas.

## Validar integração real

Com a URL pública + publishable key + os `TEST_*` no `.env.local` (as variáveis
são carregadas pelo `vitest.config.mts`):

```powershell
npm test
```

Os blocos de integração (`tests/integration/rls.integration.test.ts`) deixam de
ser pulados quando as credenciais correspondentes existem. Cenários
automatizados: anon, sem vínculo, inativo, recepcionista, autorizador e gestor.
