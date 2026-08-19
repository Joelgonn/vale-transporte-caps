# Segurança - Vale Transporte CAPS

> Documento de princípios. Não implementar nesta Sprint.

## Status de Implementação (Sprint 06 / 06.1)

- ✅ **Supabase Auth integrado** como provedor de identidade (email/senha), via `@supabase/ssr` — clientes em `lib/supabase/`.
- ✅ **Proteção de rotas funcionando** via `proxy.ts` (Next.js 16): `/dashboard` bloqueia não autenticados (redirect para `/login?next=...`); autenticados em `/login` são direcionados a `/dashboard`.
- ✅ **Validação de usuário autenticado realizada**: login real, criação/manutenção de sessão em cookie httpOnly, acesso ao dashboard, logout, bloqueio pós-logout e redirecionamento de não autenticados.
- ✅ **Nomenclatura de chave padronizada**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Publishable Key moderna). `SERVICE_ROLE_KEY` é usada **somente no servidor** (`lib/supabase/admin.ts`, Sprint 16) para a Admin API de provisionamento de usuários — com guard client-side e sem valores no repositório (`.env.example` tem apenas placeholder). **Não** se usa `sb_secret_...` nem anon key legada.
- ⏳ **Reconhecimento de perfil (provisório):** `lib/auth/profile.ts` resolve perfil/status via `user_metadata` enquanto a tabela `usuarios` não existe (ver `ROADMAP.md`, Fase 3/4). O usuário de teste manual terá `perfil = gestor` e `status_ativo = true` quando o registro funcional for criado.
- 🔜 Ainda pendente: RLS (nenhuma policy SQL escrita), tabela `usuarios`, autorização por perfil em todas as camadas.

## Princípios Fundamentais

### 1. Autenticação Obrigatória (RN07)
- **Todo acesso** ao sistema exige autenticação. Não existem rotas anônimas para dados funcionais.
- O provedor de identidade é o **Supabase Auth** (JWT), com sessão validada no servidor a cada requisição sensível.
- O usuário logado é a base para identificação em **qualquer ação** (ver `AUDIT.md`).

### 2. Autorização por Perfil
- Ações são permitidas conforme o perfil do usuário. **Perfis do MVP (Sprint 03, RN26):**
  - **Profissional Autorizador** → criar liberações (Assistente Social, Psicólogo, Terapeuta Ocupacional, **com cadastro ativo** — RN27)
  - **Recepcionista** → registrar retiradas e renovações
  - **Gestor** → administrar usuários e consultar relatórios
  - **Auditor** → fora do MVP (perfil futuro, somente leitura de logs)
- Matriz de permissões por perfil: ver `DOMAIN.md`.
- Autorização verificada em **todas as camadas** (middleware, server actions e RLS), nunca apenas na UI.
- **DECISÃO INSTITUCIONAL PENDENTE:** hierarquia de perfis, permissões granulares, múltiplos perfis por usuário, cadastro de pacientes pela recepção, consulta de relatórios por profissionais autorizadores.

### 3. Princípio do Menor Privilégio
- Cada usuário acessa apenas o necessário para sua função.
- Nenhuma exposição de dados sem necessidade — inclusive na resposta das APIs e em logs.

### 4. Proteção de Dados dos Pacientes
- Dados de saúde e pessoais dos pacientes são **sensíveis** (LGPD).
- **Não logar** dados sensíveis em texto puro (nem em logs de auditoria nem em logs de aplicação).
- **REGRA DEFINIDA (RN20):** minimização de dados — coletar apenas dados necessários ao funcionamento.
- **REGRA DEFINIDA (RN25):** identificador principal do paciente = **Gestor SUS**; CPF também armazenado.
- **DECISÃO INSTITUCIONAL PENDENTE:** criptografia/anonimização de campos sensíveis, política de retenção de dados pessoais, classificação de dados, campos adicionais do paciente.

### 5. RLS como Princípio Arquitetural
- **Row Level Security** no PostgreSQL é o mecanismo de segurança da camada de dados.
- As políticas garantem que o usuário só enxerga/altera linhas que sua função permite, **mesmo se a API for contornada**.
- A camada de banco é a última linha de defesa — toda regra de autorização deve estar refletida em RLS.

### 6. Auditoria
- Ações relevantes geram log de auditoria com identificação do usuário autenticado (ver `AUDIT.md`).
- O log funciona como **assinatura eletrônica** da ação.
- **DECISÃO PENDENTE:** imutabilidade técnica dos logs (append-only, WORM), retenção legal.

### 7. Não Expor Dados Sensíveis Desnecessariamente
- Mínimo de dados nas respostas e nas URLs (evitar IDs sequenciais previsíveis em parâmetros públicos).
- Segredos e credenciais apenas em variáveis de ambiente (nunca no código).
- Headers de segurança, cookies `httpOnly`/`secure`/`same-site`, HTTPS obrigatório.

## Controles por Camada

| Camada | Controle |
|--------|----------|
| UI (cliente) | Ocultação de ações não autorizadas (UX apenas, não é segurança) |
| Middleware Next.js | Verificação de sessão, redirecionamento para login |
| Server Actions / Server Components | Validação de sessão e permissões por ação |
| Admin API (server-only, Sprint 16) | Criação de usuários Auth com `SUPABASE_SERVICE_ROLE_KEY`; guard client-side; nunca expõe a chave |
| Supabase RLS | Isolamento no banco de dados — segurança efetiva |
| Auditoria | Registro imutável de ações relevantes |

## Matriz de Acesso RLS (conceitual — Sprint 05)

> Princípio arquitetural: toda regra de autorização será refletida em RLS. **Nenhuma policy SQL será escrita nesta fase.** Perfis do MVP: Profissional Autorizador (A), Recepcionista (R), Gestor (G).
>
> **Princípio do menor privilégio (Sprint 05):** nem todo usuário autenticado vê todos os dados. Cada perfil acessa apenas o necessário à sua função. **Dados administrativos** (usuários, auditoria) são restritos ao Gestor.

### Visão conceitual por perfil — O QUE cada perfil PRECISA ver

| Perfil | Dados de pacientes | Dados de liberações | Dados de retiradas | Dados administrativos |
|---|---|---|---|---|
| **Profissional Autorizador (A)** | Identificação (Gestor SUS, nome) e status do direito — necessários para liberar | Liberações (criar; visualizar para histórico/renovação) | — (não precisa) | — |
| **Recepcionista (R)** | Identificação (Gestor SUS, nome) e status do direito — necessários para retirada/renovação | Liberações ativas do paciente (para retirada/renovação) | Retiradas do paciente (histórico e registro) | — |
| **Gestor (G)** | Dados completos (inclui CPF) — gestão e relatórios | Liberações completas | Retiradas completas | Usuários + auditoria (administrativo) |

> **CPF (dado sensível — LGPD):** visível apenas ao **Gestor** (necessário para relatórios/gestão). Autorizador e Recepcionista **não** visualizam CPF — não é necessário para liberar/retirar (menor privilégio). **DECISÃO INSTITUCIONAL PENDENTE:** se a recepção precisa do CPF para confirmar identidade do paciente.

### Matriz RLS (perfil × operação)

| Entidade | Operação | A | R | G | Observação |
|---|---|---|---|---|---|
| **pacientes** | Visualizar | ✓ (sem CPF) | ✓ (sem CPF) | ✓ (com CPF) | A e R: apenas identificação + status; G: completo |
| | Criar | ✓ | PENDENTE | — | |
| | Alterar | ✓ | PENDENTE | — | |
| | Cancelar/inativar | — | — | ✓ | Inativação = alteração de status (ação administrativa) |
| | Administrar | — | — | ✓ | |
| **liberacoes** | Visualizar | ✓ | ✓ | ✓ | A: histórico; R: ativas do paciente; G: todas |
| | Criar | ✓ | apenas renovação | — | Autorização (RN18); renovação pela recepção (RN23) |
| | Alterar | PENDENTE | — | — | |
| | Cancelar | PENDENTE | — | PENDENTE | |
| | Administrar | — | — | — | |
| **retiradas** | Visualizar | — | ✓ | ✓ | R: do paciente (registro/histórico); G: todas; A: sem necessidade |
| | Criar | — | ✓ | — | Somente recepção (RN18) |
| | Alterar | — | — | — | Sem alteração (registro do momento) |
| | Cancelar/estorno | — | PENDENTE | — | |
| | Administrar | — | — | — | |
| **usuarios** | Visualizar | — | — | ✓ | **Dado administrativo** |
| | Criar | — | — | ✓ | |
| | Alterar | — | — | ✓ | Inclui ativação/inativação e permissões |
| | Cancelar/desativar | — | — | ✓ | |
| | Administrar | — | — | ✓ | |
| **auditoria_logs** | Visualizar | — | — | ✓ | **Dado administrativo** — Gestor (Auditor fora do MVP) |
| | Criar | automático | automático | automático | Gerado pelo sistema a partir da sessão |
| | Alterar | — | — | — | **Append-only** — sem UPDATE/DELETE |
| | Cancelar | — | — | — | |
| | Administrar | — | — | — | |

**Regras de RLS previstas (conceito, sem SQL):**
- Pacientes: linha visível a qualquer usuário autenticado do CAPS 3 (todos os perfis consultam); **CPF exposto apenas ao Gestor** (coluna-level security ou view dedicada); escrita restrita conforme matriz.
- Liberações: inserção limitada a `perfil = profissional_autorizador` com `status_ativo = true` (exceto renovação pela recepção); leitura conforme necessidade de cada perfil.
- Retiradas: inserção limitada a `perfil = recepcionista`; leitura a recepção (paciente) e gestor.
- Usuários: leitura/escrita apenas `perfil = gestor` (dado administrativo).
- Auditoria: leitura apenas `perfil = gestor`; sem permissão de escrita/atualização pela aplicação (append-only).

## Decisões de Segurança (Sprint 01, atualizado Sprint 03)

### Confirmadas
- Autenticação obrigatória para todo acesso (RN07).
- Perfis do MVP: Profissional Autorizador, Recepcionista, Gestor (Auditor fora do MVP).
- RLS como camada de segurança efetiva no banco.
- Minimização de dados: coletar apenas dados necessários ao funcionamento (RN20).
- Ações críticas auditadas; leituras não auditadas por padrão (ver `AUDIT.md`).
- MVP de uso exclusivo de uma unidade (CAPS 3), com modelagem que permite expansão.
- Profissional autorizador deve ter cadastro ativo; inativo não autoriza (RN27).
- Identificação do paciente pelo Gestor SUS + CPF (RN25).
- **Menor privilégio (Sprint 05):** nem todo usuário autenticado vê todos os dados — CPF do paciente somente ao Gestor; retiradas não visíveis ao Autorizador; dados administrativos (usuários, auditoria) restritos ao Gestor.

### Decisões Institucionais Pendentes
1. **Criação de usuários definida (Sprint 16):** Gestor ativo cria via UI com Admin API server-only e senha temporária exibida 1x (sem SMTP). **Ainda pendentes:** troca obrigatória da senha no primeiro acesso; **se um Gestor pode criar outro Gestor**; convite por e-mail quando SMTP for configurado.
2. MFA obrigatório ou opcional.
3. Cadastro/alteracão de pacientes pela recepção.
4. Consulta de relatórios por profissionais autorizadores.
5. Criptografia/anonimização de campos sensíveis (CPF, dados de saúde).
6. Imutabilidade técnica e retenção legal dos logs de auditoria.
7. Rate limiting e proteção contra brute force.
8. Classificação de dados e política de retenção (LGPD).
9. Auditoria de leitura/consulta a dados sensíveis.

- 10. **Primeiro acesso via app_metadata:** flag `precisa_trocar_senha` definido no Supabase Auth; limpeza via Admin API após troca de senha; senha temporária nunca persiste em URL, logs ou client storage.
- 11. **Troca obrigatória de senha:** senha temporária exibida 1x ao Gestor; usuário only pode acessar `/primeiro-acesso` até definir nova senha; fluxo garante que sem troca de senha não há acesso a `/dashboard` ou módulos operacionais.
- 12. **Gestor pode criar outro Gestor?** pendência institucional (já listada como item 1) — decisão será registrada formalmente.

## O que NÃO é decidido nesta Sprint

## O que NÃO é decidido nesta Sprint

- Nenhuma configuração de segurança será implementada.
- Nenhuma política RLS será escrita.
- Nenhum dado sensível será coletado ou armazenado.
