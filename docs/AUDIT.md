# Auditoria - Vale Transporte CAPS

> Documento de princípios. Não implementar nesta Sprint.

## Sprint 05 — Distinção de Papéis (Renovação × Profissional Inativo)

Na renovação, o log deve distinguir três papéis (ver `DOMAIN.md` — "Renovação e Papéis do Profissional"):

| Papel | De onde vem | Registrado como |
|---|---|---|
| **Profissional que originalmente autorizou** | `liberacoes.profissional_autorizador_id` da liberação original | **Histórico imutável** — permanece mesmo se o profissional ficar inativo depois (RN12). |
| **Profissional que autoriza a nova renovação** | Liberação renovada (nova liberação — RN23) | Deve estar **ativo** no momento (RN27). Profissional inativo **não** pode constar como autorizador de nova liberação. |
| **Usuário da recepção que registra a renovação** | **Sessão autenticada** | `auditoria_logs.usuario_id` (autor da ação). |

**Regra confirmada (Sprint 05):** um profissional inativo continua **aparecendo no histórico** das liberações que autorizou, mas **não pode** ser autorizador de novas liberações/renovações.

## Conceito de Log de Auditoria

O log de auditoria é o **registro imutável** de cada ação relevante executada no sistema. Ele documenta **quem** fez **o quê**, **quando** e **em qual registro**, funcionando como **assinatura eletrônica** da ação: a identificação do usuário é derivada da autenticação, não de um campo preenchido manualmente.

## Diferença entre Dado Operacional e Log de Auditoria

| | Dado Operacional | Log de Auditoria |
|---|---|---|
| Propósito | Estado atual do negócio | Histórico da ação |
| Natureza | Mutável (atualizável) | Imutável (append-only) |
| Exemplo | `liberacoes` com saldo atual | `auditoria_logs` com "Liberação criada" |
| Sobrevive a alterações? | É alterado/sobrescrito | Preserva o registro histórico |

**Regra confirmada (RN12):** o histórico deve ser preservado mesmo quando dados cadastrais forem posteriormente alterados. Ou seja, o log **não** é reescrito quando o cadastro muda.

## Ações que Devem Ser Auditadas (Sprint 01)

A auditoria diferencia **ações críticas** (obrigatoriamente registradas) de **ações comuns** (não auditadas por padrão).

### Ações Críticas — auditadas obrigatoriamente (RN19)

| Entidade | Ações críticas |
|---|---|
| **Pacientes** | Cadastro, alteração de dados, inativação/reativação do direito ao benefício |
| **Liberações** | Autorização (criação), renovação, alteração, cancelamento |
| **Retiradas** | Registro da retirada, cancelamento/estorno |
| **Usuários** | Criação, alteração de perfil/permissões, ativação/desativação |
| **Autenticação** | Login bem-sucedido (trilha de acesso) e tentativas de login malsucedidas (registro de segurança) |

### Distinção dos papéis no log (RN28 — Sprint 03)

A auditoria deve registrar, de forma clara e separada, **quem autorizou**, **quem registrou**, **quem realizou a retirada** e a **data/hora de cada ação**:

| Momento | Quem deve ser identificado | Informação essencial |
|---|---|---|
| **Autorização** | Profissional autorizador (Assistente Social, Psicólogo, Terapeuta Ocupacional) | quem autorizou + data/hora |
| **Registro da liberação** | Quem registrou a liberação no sistema (profissional autorizador ou, na renovação, o usuário da recepção) | quem registrou + data/hora |
| **Renovação** | Usuário da recepção que registrou + profissional autorizador identificado | usuário da recepção + data/hora + profissional autorizador (RN23) |
| **Retirada** | Recepcionista que registrou + paciente que retirou | recepcionista + paciente + data/hora (RN28) |
| **Cancelamento** | Usuário que cancelou | quem cancelou + data/hora + registro afetado |
| **Alterações administrativas** | Usuário que alterou (pacientes, usuários, perfis) | quem alterou + data/hora + dados antes/depois |

> O autor da ação é sempre derivado da **sessão autenticada** (nunca preenchido manualmente). O profissional autorizador da renovação é o registrado na liberação anterior (RN23).

### Eventos de Auditoria Obrigatórios (Sprint 04)

Identificadores canônicos de ação a serem usados em `auditoria_logs.acao`:

| Evento | Identificador | Informações gravadas |
|---|---|---|
| Criação de liberação | `liberacao.criada` | usuário (sessão), profissional autorizador, paciente, tipo, quantidade, datas |
| Renovação | `liberacao.renovada` | usuário da recepção (sessão), profissional autorizador da liberação anterior, paciente, novo período |
| Retirada | `retirada.registrada` | recepcionista (sessão), **paciente que retirou**, quantidade, data/hora |
| Cancelamento de liberação | `liberacao.cancelada` | usuário (sessão), liberação afetada |
| Cancelamento/estorno de retirada | `retirada.cancelada` | usuário (sessão), retirada afetada |
| Alteração administrativa crítica | `paciente.alterado`, `paciente.status_alterado` | usuário (sessão), dados antes/depois |
| Ativação/inativação de profissional | `usuario.status_alterado` | usuário (sessão), profissional afetado |
| Alterações de permissões | `usuario.perfil_alterado` | usuário (sessão), dados antes/depois |
| Cadastro de paciente | `paciente.criado` | usuário (sessão) |
| Criação/gestão de usuários | `usuario.criado`, `usuario.alterado` | usuário (sessão) |
| Autenticação | `auth.login_sucesso`, `auth.login_falha` | usuário/email, data/hora |

**Campos obrigatórios por papel (Sprint 05):** cada log distingue explicitamente:
- **profissional que autorizou** → `profissional_autorizador_id` (em `dados_depois` quando o autor da sessão é outro usuário);
- **usuário que registrou/renovou/realizou a retirada** → `auditoria_logs.usuario_id` (sempre da sessão autenticada);
- **paciente que recebeu** → `entidade_id` + `entidade_tipo = 'retiradas'` (dados da retirada em `dados_depois`);
- **data/hora** → `data_hora` (RN09).

> **Distinção obrigatória (RN28 + Sprint 05):** o usuário da sessão nunca é "inventado"; quando o autor da ação difere do profissional responsável (renovação pela recepção), o log grava **ambos** — sessão em `usuario_id` e profissional em `dados_depois` — preservando o vínculo de responsabilidade.

**O usuário responsável deve SEMPRE ser obtido da sessão autenticada** — nunca informado manualmente pelo formulário. Na renovação, o log deve conter tanto o usuário da recepção (autor da ação) quanto o profissional autorizador identificado (RN23, RN28).

### Ações Comuns — NÃO auditadas por padrão

- Leituras/consultas e listagens de dados.
- Ações de baixo valor de auditoria (visualização de telas, buscas sem efeito de negócio).

**DECISÃO INSTITUCIONAL PENDENTE:** auditoria de leitura/consulta a dados sensíveis (LGPD).

## Estrutura Mínima do Log (RN09)

Todo log deve conter, no mínimo:

1. **Usuário** — identificador do usuário autenticado que executou a ação.
2. **Ação** — descrição/identificador da ação (ex: `liberacao.criada`, `retirada.registrada`).
3. **Data/hora** — timestamp do momento da ação.
4. **Registro afetado** — tipo da entidade + identificador do registro.

**Opcional/planejado (DECISÃO PENDENTE):**
- Dados anteriores e posteriores (before/after) para alterações.
- IP / device / user-agent.

> **Hash de integridade (DECISÃO TÉCNICA FUTURA — Sprint 05):** **não implementar agora** hash chain/encadeamento. Documentado como decisão técnica futura; nenhum campo reservado no schema atual (ver `DATABASE.md`).

## Identificação do Usuário

- Provém **exclusivamente da sessão autenticada** (JWT/Supabase Auth).
- Não pode ser fornecida pelo cliente — o sistema deriva o autor da própria autenticação.
- Isso é o que dá ao log o valor de **assinatura eletrônica**: não é possível, via interface, registrar uma ação atribuída a outra pessoa.

## Timestamp

- Registrado no momento da ação, preferencialmente pela camada de persistência (autoridade de tempo única do banco).
- **DECISÃO PENDENTE:** fuso horário de referência (UTC) e formato canônico.

## Imutabilidade como Princípio

- Logs não podem ser alterados nem excluídos pela aplicação.
- **Princípios atuais (Sprint 05):** append-only; usuário sempre da sessão autenticada; sem edição manual de logs; Gestor pode consultar; ações críticas obrigatoriamente registradas.
- **DECISÃO PENDENTE (técnica/futura):** reforço criptográfico — hash chain, WORM storage, revogação de UPDATE/DELETE no banco.
- **DECISÃO PENDENTE:** retenção legal e arquivamento (prazo definido por regra institucional/legislação).

## Assinatura Eletrônica / Auditoria Baseada na Autenticação

A assinatura eletrônica neste contexto é a **combinação de identidade autenticada + ação + timestamp + registro afetado**, registrada de forma imutável. Não há assinatura criptográfica manual: a autenticação do usuário (com credenciais próprias) é o vínculo confiável entre o autor e a ação.

## Sprint 44 — Histórico Estado + Eventos

O histórico evolui de **Estado atual + soma de retiradas** para **Estado atual + Eventos**.
- **Estado atual:** paciente/tipo/período/previsão/retirado/diferença/status/datas (via `liberacoes` + `retiradas`).
- **Eventos:** criação/renovação/retirada/alteração de previsão/vigência/cancelamento — fonte única `auditoria_logs` (sem segunda trilha). `lib/domain/relatorios/eventos.ts` define `HistoricoCompleto` e mapeamento puro.
- **P1 Vigência:** alteração que excluiria retiradas é rejeitada (preserva semântica do evento original).
- **Estouro (RN31):** retirada acima da previsão não é bloqueada; o domínio apenas sinaliza via `isEstouro`/`estadoPrevisao` para a próxima UX.

## O que NÃO é decidido nesta Sprint

- Nenhuma tabela de auditoria será criada.
- Nenhum log será gerado.
- Nenhum trigger, política de imutabilidade ou serviço de auditoria será implementado.
