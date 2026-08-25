# Banco de Dados - Vale Transporte CAPS

> **Status:** Sprint 05 — **REVISÃO FINAL do modelo lógico**. Especificação pronta para futura implementação no Supabase. **Nenhuma tabela, migration ou SQL será criado nesta fase.**

## Princípios Gerais

- **PostgreSQL (Supabase)** como banco de dados relacional.
- **Row Level Security (RLS)** como princípio arquitetural (matriz conceitual em `SECURITY.md`).
- Separação entre **dado operacional** (mutável) e **log de auditoria** (imutável, `AUDIT.md`).
- **Minimização de dados (RN20):** apenas campos necessários ao funcionamento. Sem campos clínicos ou administrativos.
- MVP de uma unidade (CAPS 3); campo `unidade_id` **opcional** nas tabelas operacionais para expansão futura (RN17).
- Convenções: PKs por `uuid`; timestamps em `timestamptz` (UTC); enums para valores fechados.

## Entidade 1 — `pacientes`

**Finalidade:** cadastro da pessoa em acompanhamento no CAPS com direito ao benefício.

| Campo | Tipo lógico | Obrigatório | Padrão | Observação |
|---|---|---|---|---|
| `id` | uuid | sim | gerado | **PK** |
| `gestor_sus` | text | sim | — | **Identificador principal do domínio** (RN25). UNIQUE. |
| `nome` | text | sim | — | |
| `cpf` | text | não | null | Dado sensível — LGPD. UNIQUE quando preenchido. **Mantido OPCIONAL (Sprint 05)** — obrigatoriedade permanece DECISÃO INSTITUCIONAL PENDENTE; não aplicar NOT NULL. |
| `status` | enum `status_paciente` (`ativo`, `inativo`) | sim | `ativo` | Status do direito ao benefício (RN01). |
| `origem` | enum `origem_paciente` (`regular`, `esporadico`) | sim | `regular` | **Sprint 38 (RN29):** `regular` = acompanhamento contínuo (cadastro por gestor/autorizador); `esporadico` = atendimento pontual criado pela recepção, recebe SOMENTE liberação avulsa. Pacientes pré-existentes = `regular`. **Sprint 41 (RN30): IMUTÁVEL após o cadastro — nenhum perfil converte origem (trigger `fn_pacientes_before`, migration `20260825000001`).** |
| `data_inicio_acompanhamento` | date | não | null | |
| `data_fim_acompanhamento` | date | não | null | |
| `unidade_id` | uuid | não | null | Expansão futura (RN17). |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | Atualizado em alterações. |

**Relacionamentos:** `1 ───< N liberacoes`; `1 ───< N retiradas`.
**Constraints:** `UNIQUE(gestor_sus)`; `UNIQUE(cpf)` (quando preenchido); check `status in ('ativo','inativo')`.
**Índices:** `UNIQUE(gestor_sus)`; `UNIQUE(cpf)`; índice em `(status)`.
**Campos de status:** `status`.
**Campos de data/hora:** `data_inicio_acompanhamento`, `data_fim_acompanhamento`, `created_at`, `updated_at`.
**Regras de integridade:** RN01 (apenas ativos recebem vales); RN25 (Gestor SUS principal); RN20 (minimização — evitar dados sensíveis desnecessários); **RN29 (Sprint 38): origem do paciente — esporádico somente liberação avulsa (trigger `fn_liberacoes_before`); INSERT por perfil × origem via RLS (`pacientes_insert_regular` para gestor/autorizador, `pacientes_insert_recepcao_esporadico` para a recepção — migration `20260821000001`).**; **RN30 (Sprint 41): origem IMUTÁVEL após o cadastro — `fn_pacientes_before` rejeita qualquer UPDATE que altere `origem`, para todos os perfis (migration `20260825000001`). Edição de pacientes (mesma migration + app): gestor altera SOMENTE `status`; autorizador edita dados cadastrais (nunca status/origem/gestor_sus/cpf); recepcionista não edita. A trilha (`pacientes_audit`) inclui `cpf` e `origem` nos snapshots antes/depois.**

## Entidade 2 — `usuarios`

**Finalidade:** usuário do sistema, vinculado à identidade do provedor de autenticação (Supabase Auth).

| Campo | Tipo lógico | Obrigatório | Padrão | Observação |
|---|---|---|---|---|
| `id` | uuid | sim | gerado | **PK** |
| `auth_user_id` | uuid | sim | — | **Identidade vinculada ao sistema de autenticação**. UNIQUE. FK lógica → `auth.users`. |
| `nome` | text | sim | — | |
| `email` | text | sim | — | UNIQUE. |
| `perfil` | enum `perfil_usuario` (`profissional_autorizador`, `recepcionista`, `gestor`) | sim | — | Perfis do MVP (RN26). |
| `profissao` | enum `profissao` (`assistente_social`, `psicologo`, `terapeuta_ocupacional`) | não | null | Obrigatória quando `perfil = profissional_autorizador` (RN02). |
| `status_ativo` | boolean | sim | `true` | Profissional inativo não autoriza (RN27). |
| `unidade_id` | uuid | não | null | Expansão futura (RN17). |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | |

**Relacionamentos:** `1 ───< N liberacoes` (profissional autorizador e registro); `1 ───< N retiradas` (recepção); `1 ───< N auditoria_logs`.
**Constraints:** `UNIQUE(auth_user_id)`; `UNIQUE(email)`; check que vincula `profissao` e `perfil`: se `perfil = profissional_autorizador` então `profissao IS NOT NULL`.
**Índices:** `UNIQUE(auth_user_id)`; `UNIQUE(email)`; índice em `(perfil, status_ativo)`.
**Campos de status:** `status_ativo`.
**Campos de data/hora:** `created_at`, `updated_at`.
**Regras de integridade:** RN02 (somente AS, Psicólogo e TO autorizam); RN26 (perfis do MVP); RN27 (ativo para autorizar).

> **Pode autorizar (RESOLVIDO — Sprint 05):** não existe coluna `pode_autorizar`. A capacidade de autorizar é **derivada** de `perfil = 'profissional_autorizador'` + `profissao IS NOT NULL` + `status_ativo = true` (RN27). A aplicação avalia esses três atributos no momento da liberação; nenhuma flag redundante é armazenada (RN20 — minimização de dados).

## Entidade 3 — `liberacoes`

**Finalidade:** autorização de entrega de vales a um paciente.

| Campo | Tipo lógico | Obrigatório | Padrão | Observação |
|---|---|---|---|---|
| `id` | uuid | sim | gerado | **PK** |
| `paciente_id` | uuid | sim | — | **FK → `pacientes.id`**. |
| `tipo` | enum `tipo_liberacao` (`continua`, `avulsa`) | sim | — | RN05. |
| `periodo_meses` | smallint | não | null | **Somente contínua**: 1, 3 ou 6 (RN13). Nulo para avulsa. |
| `quantidade` | smallint | sim | — | 1, 2, 4 ou 8 (RN04).  **Sprint 42:** PREVISÃO administrativa (RN04) — NÃO bloqueia retiradas (RN31); retirado pode exceder. CHECK in (1,2,4,8). |
| `data_inicio` | timestamptz | sim | `now()` | Início da validade. |
| `data_fim` | timestamptz | sim | calculado | Contínua: `data_inicio + periodo_meses`; avulsa: `data_inicio + 1 dia` (RN13, RN21). |
| `profissional_autorizador_id` | uuid | sim | — | **FK → `usuarios.id`** (RN03). Deve ser `perfil = profissional_autorizador` e `status_ativo = true`. |
| `registrado_por_id` | uuid | sim | — | **FK → `usuarios.id`**. Quem registrou: profissional na criação; recepção na renovação (RN23). |
| `renovacao_de_id` | uuid | não | null | **FK → `liberacoes.id`** (auto-relacionamento) — liberação anterior (RN23). |
| `status` | enum `status_liberacao` (`ativa`, `expirada`, `cancelada`) | sim | `ativa` | |
| `justificativa` | text | não | null | Especialmente para avulsa. |
| `unidade_id` | uuid | não | null | Expansão futura (RN17). |
| `created_at` | timestamptz | sim | `now()` | |
| `updated_at` | timestamptz | sim | `now()` | |

**Relacionamentos:** `N ───< 1 pacientes`; `N ───< 1 usuarios` (autorizador); `N ───< 1 usuarios` (registrador); `1 ───< N retiradas`; `1 ───< N liberacoes` (renovações).
**Constraints:**
- check `tipo in ('continua','avulsa')`
- check `quantidade in (1,2,4,8)`
- check `periodo_meses in (1,3,6)` quando contínua; `periodo_meses IS NULL` quando avulsa
- check `data_fim > data_inicio`
- `profissional_autorizador_id` e `registrado_por_id` são **papéis distintos** (Resolução Sprint 05): na criação, o autorizador também registra (iguais); na renovação, a recepção registra e o autorizador é o profissional mantido (diferentes). Nenhuma constraint os obriga a diferir — a regra vem do fluxo (RN18, RN23).
- `renovacao_de_id` deve referenciar liberação do mesmo `paciente_id` e com `status` não ativa (validação de serviço; constraint com subquery a avaliar)
**Índices:** `(paciente_id, status)`; `(profissional_autorizador_id)`; `(renovacao_de_id)`; `(data_fim)`; `(tipo, quantidade)`.
**Campos de status:** `status`.
**Campos de data/hora:** `data_inicio`, `data_fim`, `created_at`, `updated_at`.
**Regras de integridade:** RN03, RN04, RN05, RN13, RN21, RN23, RN27.

## Entidade 4 — `retiradas`

**Finalidade:** entrega dos vales ao paciente na recepção, registrada no momento da retirada (RN22).

| Campo | Tipo lógico | Obrigatório | Padrão | Observação |
|---|---|---|---|---|
| `id` | uuid | sim | gerado | **PK** |
| `liberacao_id` | uuid | sim | — | **FK → `liberacoes.id`** (RN14). |
| `paciente_id` | uuid | sim | — | **FK → `pacientes.id`** — deve ser igual ao paciente da liberação (RN24). |
| `recepcionista_id` | uuid | sim | — | **FK → `usuarios.id`** — perfil recepção (RN18). |
| `quantidade` | smallint | sim | — | Inteiro positivo ≤ quantidade restante da liberação. **DECISÃO INSTITUCIONAL PENDENTE:** restrição a 1/2/4/8 na retirada. |
| `data_hora` | timestamptz | sim | `now()` | Momento da entrega (auditoria — RN28). |
| `unidade_id` | uuid | não | null | Expansão futura (RN17). |

**Relacionamentos:** `N ───< 1 liberacoes`; `N ───< 1 pacientes`; `N ───< 1 usuarios`.
**Constraints:**
- check `quantidade > 0`
- check `quantidade <= (SELECT quantidade FROM liberacoes WHERE id = liberacao_id)` — quantidade não pode exceder o autorizado
- check `quantidade <= quantidade restante` — nunca exceder a soma já retirada (ver Resolução Sprint 05)
- check `paciente_id = (SELECT paciente_id FROM liberacoes WHERE id = liberacao_id)` — somente o próprio paciente (RN24)
- check `data_hora BETWEEN (SELECT data_inicio ...) AND (SELECT data_fim ...)` — retirada dentro da validade
- **DECISÃO INSTITUCIONAL PENDENTE:** soma das retiradas de uma liberação limitada à quantidade autorizada (depende do parcelamento)
**Índices:** `(liberacao_id)`; `(paciente_id)`; `(recepcionista_id)`; `(data_hora)`.
**Campos de status:** não possui.
**Campos de data/hora:** `data_hora`.
**Regras de integridade:** RN14, RN18, RN22, RN24, RN28.

### Resolução conceitual — Retiradas (Sprint 05)

| Ponto | Situação |
|---|---|
| Quantidade por retirada obrigatória 1/2/4/8? | **DECISÃO INSTITUCIONAL PENDENTE** — não definida na documentação. Opções: qualquer inteiro até o restante, ou restrita a 1/2/4/8. |
| Liberação pode ser retirada parcialmente? | **DECISÃO INSTITUCIONAL PENDENTE** — depende do parcelamento (RN16). |
| Liberação pode ter múltiplas retiradas? | **DECISÃO INSTITUCIONAL PENDENTE** — a estrutura suporta `1 ───< N retiradas`; se proibido, validação de serviço (uma retirada por liberação). |
| Como o sistema calcula o total retirado? | **DECISÃO TÉCNICA:** `total_retirado = SUM(retiradas.quantidade)` da liberação (retiradas registradas). |
| Existe saldo? | **REGRA DEFINIDA (RN22):** não há saldo **acumulado entre liberações**. Por liberação existe "quantidade restante" = autorizada − total_retirado (controle técnico, não é saldo transferível). |
| O que ocorre quando totalmente retirada? | O sistema impede novas retiradas (quantidade restante = 0). A liberação permanece `ativa` até `data_fim`/cancelamento; não há status "esgotada" definido. |

> **Princípio (Sprint 05):** nenhuma regra de retirada é inventada; o que a documentação define (RN14, RN16, RN22) é aplicado, e o restante permanece **DECISÃO INSTITUCIONAL PENDENTE**.

## Entidade 5 — `auditoria_logs`

**Finalidade:** registro imutável de ações relevantes (ver `AUDIT.md`). **Append-only** — estrutura preparada para imutabilidade.

| Campo | Tipo lógico | Obrigatório | Padrão | Observação |
|---|---|---|---|---|
| `id` | bigint | sim | sequencial | **PK** |
| `usuario_id` | uuid | sim | — | **FK → `usuarios.id`** — sempre obtido da **sessão autenticada**, nunca de formulário. |
| `acao` | text/enum | sim | — | Identificadores canônicos (ver `AUDIT.md`), ex.: `liberacao.criada`. |
| `entidade_tipo` | text | sim | — | Ex.: `pacientes`, `liberacoes`, `retiradas`, `usuarios`. |
| `entidade_id` | uuid | sim | — | Registro afetado (polimórfico). |
| `dados_antes` | jsonb | não | null | Valores anteriores (alterações). |
| `dados_depois` | jsonb | não | null | Valores posteriores. |
| `data_hora` | timestamptz | sim | `now()` | Timestamp (RN09). |

**Relacionamentos:** `N ───< 1 usuarios`; referência polimórfica às entidades afetadas.
**Constraints:** append-only — **sem UPDATE/DELETE pela aplicação**; a própria aplicação não possui permissão de alterar/excluir.
**Índices:** `(usuario_id)`; `(entidade_tipo, entidade_id)`; `(data_hora)`.
**Campos de status:** não possui.
**Campos de data/hora:** `data_hora`.
**Regras de integridade:** RN09, RN12, RN19, RN28.

> **Hash de integridade (DECISÃO TÉCNICA FUTURA — Sprint 05):** **não implementar agora** hash chain/encadeamento. Princípios atuais: append-only; usuário sempre da sessão autenticada; sem edição manual de logs; Gestor pode consultar; ações críticas obrigatoriamente registradas. Reforço criptográfico (hash chain, WORM) será avaliado em fase futura, **sem campo reservado no schema atual**.

## Relacionamentos (Resumo)

```
usuarios (1) ───< (N) liberacoes   -- profissional autorizador
usuarios (1) ───< (N) liberacoes   -- usuário que registrou (recepção na renovação)
pacientes (1) ───< (N) liberacoes  -- beneficiário
liberacoes (1) ───< (N) retiradas  -- parcelamento a confirmar
liberacoes (1) ───< (N) liberacoes -- renovação referencia liberação anterior (RN23)
usuarios (1) ───< (N) retiradas    -- recepcionista
pacientes (1) ───< (N) retiradas   -- somente o próprio paciente (RN24)
usuarios (1) ───< (N) auditoria_logs
```

## Constraints de Integridade (Consolidadas)

1. `pacientes.gestor_sus` UNIQUE.
2. `pacientes.cpf` UNIQUE quando preenchido; **obrigatoriedade pendente (mantido opcional — Sprint 05)**.
3. `usuarios.auth_user_id` UNIQUE; `usuarios.email` UNIQUE.
4. `liberacoes.quantidade IN (1,2,4,8)`.
5. `liberacoes.tipo IN ('continua','avulsa')`.
6. `liberacoes.periodo_meses IN (1,3,6)` para contínua; NULL para avulsa.
7. `liberacoes.data_fim > liberacoes.data_inicio`.
8. Profissional autorizador: `perfil = profissional_autorizador` e `status_ativo = true` (RN27) — deriva a capacidade de autorizar (sem coluna `pode_autorizar`).
9. `retiradas.quantidade > 0` e ≤ quantidade autorizada da liberação.
10. `retiradas.paciente_id = liberacoes.paciente_id` (RN24).
11. `retiradas.data_hora` dentro de `[data_inicio, data_fim]` da liberação.
12. Renovação (`renovacao_de_id`) referenciando liberação anterior do mesmo paciente (RN23).
13. `retiradas.quantidade` nunca excede a quantidade restante (autorizada − soma das retiradas) — DECISÃO TÉCNICA (Sprint 05).
14. **Sem** constraint de unicidade de liberação ativa por paciente (Sprint 05 — DECISÃO INSTITUCIONAL PENDENTE).

## Índices (Consolidados)

- `pacientes`: unique `gestor_sus`; unique `cpf`; `(status)`.
- `usuarios`: unique `auth_user_id`; unique `email`; `(perfil, status_ativo)`.
- `liberacoes`: `(paciente_id, status)`; `(profissional_autorizador_id)`; `(renovacao_de_id)`; `(data_fim)`.
- `retiradas`: `(liberacao_id)`; `(paciente_id)`; `(recepcionista_id)`; `(data_hora)`.
- `auditoria_logs`: `(usuario_id)`; `(entidade_tipo, entidade_id)`; `(data_hora)`.

## Não resolvido nesta Sprint (DECISÃO PENDENTE)

> **Atualizado Sprint 05:** itens marcados como RESOLVIDO foram decididos nesta revisão (ver "Resoluções Sprint 05" no final).

- **Parcelamento** da retirada (uma liberação pode ter múltiplas retiradas? soma limite?). — **DECISÃO INSTITUCIONAL PENDENTE** (Sprint 05).
- **Quantidade permitida em cada retirada** (restrição a 1/2/4/8 na retirada ou livre até o autorizado). — **DECISÃO INSTITUCIONAL PENDENTE** (Sprint 05).
- **Múltiplas liberações simultâneas** para o mesmo paciente. — **DECISÃO INSTITUCIONAL PENDENTE** (Sprint 05). **Sem constraint de unicidade no schema**: o modelo permite N liberações por paciente; a regra de "uma ativa por vez" (se aprovada) será validada em serviço, não no banco.
- **Comprovante** de retirada (impresso/digital).
- **Estoque físico** de vales.
- **Numeração individual** dos vales físicos.
- **Obrigatoriedade do CPF** do paciente. — Mantido opcional (Sprint 05).
- **Relação `profissional_autorizador_id` vs. `registrado_por_id`** na renovação — RESOLVIDO (Sprint 05): são papéis distintos; ver conflito nº 2 abaixo e seção "Renovação e Papéis do Profissional" em `DOMAIN.md`.
- **Retenção/arquivamento** de dados e logs.
- **Campos adicionais do paciente.**

## Possíveis Conflitos ou Ambiguidades Encontrados

1. **CPF armazenado mas obrigatoriedade indefinida** — RN25 diz "também será armazenado", sem exigir preenchimento obrigatório. **RESOLVIDO (Sprint 05):** `cpf` permanece **opcional** (NOT NULL não aplicado); obrigatoriedade fica como DECISÃO INSTITUCIONAL PENDENTE.
2. **Renovação x profissional inativo (RN23 × RN27)** — a renovação mantém o profissional autorizador da liberação anterior; se esse profissional estiver **inativo** no momento da renovação, deve ser mantido (RN23) ou a renovação é bloqueada (RN27)? **RESOLVIDO (Sprint 05):** distinguem-se três papéis — quem originalmente autorizou (histórico imutável), quem autoriza uma nova renovação (deve estar **ativo** — RN27) e quem registra na recepção (sessão). **DECISÃO INSTITUCIONAL PENDENTE:** procedimento quando o profissional original estiver inativo no momento da renovação (ver `DOMAIN.md`).
3. **`pode_autorizar`** — campo derivado (perfil+profissão+status) vs. coluna materializada. **RESOLVIDO (Sprint 05):** coluna **removida**; capacidade de autorizar é **derivada** de `perfil + profissao + status_ativo`.
4. **Renovação registrada pela recepção** — o autor da ação no log é a recepção (sessão), mas o responsável pela autorização é o profissional da liberação anterior. **RESOLVIDO (Sprint 05):** a auditoria grava **ambos** — `usuario_id` (sessão, recepção) e o profissional autorizador em `dados_depois` (RN28) — ver `AUDIT.md`.
5. **Parcelamento × quantidade total** — se parcelado for permitido, é preciso decidir se a soma das retiradas pode superar a quantidade autorizada. **DECISÃO INSTITUCIONAL PENDENTE** (Sprint 05): a estrutura suporta as duas opções; a regra será validação de serviço.

## Resoluções Sprint 05

1. **`pode_autorizar` removido** — capacidade derivada de `perfil + profissao + status_ativo` (RN20, RN27).
2. **CPF opcional** — NOT NULL não aplicado; obrigatoriedade institucional pendente.
3. **Renovação: três papéis distintos** — autorizou / autoriza nova renovação / registrou na recepção (RN18, RN23, RN27).
4. **Retiradas: regras conceituais definidas** — total retirado por soma; quantidade restante por liberação; sem saldo acumulado entre liberações (RN22); o restante (parcelamento, quantidade, múltiplas retiradas) permanece DECISÃO INSTITUCIONAL PENDENTE.
5. **Múltiplas liberações** — sem constraint de unicidade; regra a definir em serviço se aprovada.
6. **Hash de integridade** — não implementado; decisão técnica futura, sem campo no schema.

## Revisão de Campos — Justificativa de Domínio (Sprint 05)

Cada campo foi avaliado: *é necessário para uma regra, operação, segurança ou relatório?*

| Campo | Necessário? | Justificativa / Decisão |
|---|---|---|
| `pacientes.data_inicio_acompanhamento`, `data_fim_acompanhamento` | Parcial | Nenhuma regra de negócio as utiliza (validade é por liberação — RN13/RN21). Justificativa possível: relatório de pacientes em acompanhamento. **DECISÃO PENDENTE:** manter (relatório) ou remover (RN20). |
| `liberacoes.justificativa` | Parcial | Contexto da liberação avulsa (atributo do domínio); sem regra associada. **DECISÃO PENDENTE:** manter como opcional ou remover. |
| `unidade_id` (todas as tabelas) | Não no MVP | Nenhuma regra/operação/segurança/relatório do MVP a utiliza. Mantida **apenas** por decisão técnica RN17 (expansão futura). **DECISÃO PENDENTE:** manter opcional ou remover até a expansão multi-CAPS. |
| `retiradas.data_hora` | Sim | Regra/auditoria (RN28) e relatórios por período. |
| `usuarios.email` | Sim | Operação (identificação/login) e UNIQUE. |
| `liberacoes.renovacao_de_id` | Sim | Regra RN23 (renovação). |
| `auditoria_logs.dados_antes/dados_depois` | Sim | Auditoria de alterações (RN19). |
| Demais campos | Sim | Regra, operação ou relatório diretamente associados (RN01–RN28). |

> **Princípio (Sprint 05):** nenhum campo é mantido "por precaução"; campos sem regra/operação/segurança/relatório que o justifiquem são marcados para remoção ou ficam como DECISÃO PENDENTE.

## O que NÃO será feito nesta fase

- Não criar tabelas no Supabase.
- Não executar SQL.
- Não criar migrations.
- Não implementar autenticação, APIs ou telas.


## Sprint 42 — Edição de liberações e previsão (migration 20260826000001)

- `fn_retiradas_before`: removidas as checagens de limite por quantidade (previsão não bloqueia — RN31). PRESERVADO: FOR UPDATE, status 'ativa', RN24, janela RN13/RN21, RN01.
- `fn_liberacoes_before`: nova branch de UPDATE — campos históricos imutáveis (paciente/tipo/período/autorizador/registro/renovação); gestor altera somente status+unidade_id; autorizador altera quantidade(previsão)/datas/justificativa/unidade_id.
- Novo: grant UPDATE em liberacoes p/ authenticated + policy `liberacoes_update_autorizador_gestor`.

- **Sprint 42.2:** `liberacoes_quantidade_check` redefinida para `quantidade between 1 and 999` (migration `20260826000002_liberacoes_previsao_check.sql` — NÃO aplicada ainda; aplicar com autorização explícita). Retrocompatível: liberações existentes (1..8) satisfazem a nova constraint.
