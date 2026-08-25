# Domínio - Vale Transporte CAPS

## Conceitos do Domínio

### Paciente
Pessoa em acompanhamento no CAPS que possui direito ao benefício de Vale-Transporte Social.

**Atributos confirmados (Sprint 03):**
- Identificador principal: **Gestor SUS**
- Nome completo
- CPF (dado sensível — LGPD; também armazenado)
- Status de direito ao benefício (ativo/inativo)
- Data de início do acompanhamento
- Data de fim do acompanhamento (se aplicável)

**REGRA DEFINIDA (RN25):** a identificação principal do paciente é o número do **Gestor SUS**; o **CPF** também é armazenado.

**DECISÃO INSTITUCIONAL PENDENTE:** campos adicionais do cadastro (endereço, telefone, diagnóstico, etc.).

### Usuário
Pessoa física que acessa o sistema com credenciais próprias.

**Perfis do MVP (REGRA DEFINIDA — Sprint 03, RN26):**
- **Profissional Autorizador**: Assistente Social, Psicólogo, Terapeuta Ocupacional (podem liberar vales)
- **Recepcionista**: Registra retiradas e renovações
- **Gestor**: Administra usuários e consulta relatórios

**Auditor está FORA do MVP** (perfil futuro, somente leitura de logs de auditoria).

**DECISÃO INSTITUCIONAL PENDENTE:** hierarquia de perfis, permissões granulares, múltiplos perfis por usuário.

### Profissional Autorizador
Usuário com perfil específico habilitado a realizar liberações de vales.

**Tipos confirmados:**
- Assistente Social
- Psicólogo
- Terapeuta Ocupacional

**Regra:** Todo profissional autorizador é um usuário, mas nem todo usuário é profissional autorizador.

**REGRA DEFINIDA (RN27):** o profissional autorizador deve possuir **cadastro ativo**; profissional inativo **não pode autorizar novas liberações**; o sistema deve exibir **alertas claros** para profissionais inativos.

**DECISÃO INSTITUCIONAL PENDENTE:** se haverá validação adicional (ex.: registro no conselho regional) além do vínculo ativo.

**Capacidade de autorizar (RESOLVIDO — Sprint 05):** não existe flag `pode_autorizar`. A capacidade de autorizar é **derivada** de `perfil = profissional_autorizador` + `profissao preenchida` + `status_ativo = true` (RN27), avaliada no momento da liberação. Evita redundância e inconsistência (RN20).

### Renovação e Papéis do Profissional (Sprint 05)

Distinção obrigatória de três papéis na renovação:

- **Profissional que originalmente autorizou** — registrado em `liberacoes.profissional_autorizador_id`. É **registro histórico imutável** (RN12): permanece identificado nas liberações que autorizou, mesmo que se torne **inativo** posteriormente.
- **Profissional que autoriza uma nova renovação** — a renovação é uma **nova liberação** (RN23); profissional **inativo NÃO pode autorizar** novas liberações (RN27). Se o profissional original estiver **ativo**, pode ser mantido como autorizador da renovação; se inativo, não pode autorizar.
- **Profissional que registra a renovação na recepção** — usuário da **recepção** autenticado (sessão), registrado em `liberacoes.registrado_por_id` (RN23). Registra a nova liberação, mas **não é o autorizador**.

**REGRA DEFINIDA:** o histórico preserva o autorizador original; profissional inativo não autoriza novas liberações.

**DECISÃO INSTITUCIONAL PENDENTE:** procedimento quando o profissional da liberação anterior estiver **inativo** no momento da renovação — opções: bloquear a renovação; exigir nova autorização de outro profissional ativo; registrar autorização prévia. A definir pela gestão.

### Liberação
Ato de autorizar a entrega de vales a um paciente.

**Atributos:**
- Paciente beneficiário
- Profissional autorizador (quem liberou)
- Tipo de liberação: **contínua** ou **avulsa**
- Quantidade de vales: 1, 2, 4 ou 8
- Data/hora da liberação
- Período de validade (para liberação contínua)
- Justificativa/observação (especialmente para avulsa)

**Regras de negócio:**
- Apenas profissionais autorizados podem liberar
- Profissional responsável deve ser identificado (assinatura eletrônica via autenticação)
- Quantidade restrita aos valores: 1, 2, 4, 8
- Dois tipos mutuamente exclusivos: contínua ou avulsa

**Decisões (Sprint 03):**
- REGRA DEFINIDA (RN13): liberação contínua é válida por **período determinado de 1, 3 ou 6 meses**; após o vencimento, é necessária uma nova liberação/renovação.
- REGRA DEFINIDA (RN21): liberação avulsa tem validade de **1 dia**.
- REGRA DEFINIDA (RN22): **não há saldo acumulado entre liberações**; a autorização é apresentada no momento da retirada e a entrega é registrada naquele momento.
- REGRA DEFINIDA (RN23): a renovação é uma **nova liberação** registrada ao término do período anterior, mantendo o profissional autorizador identificado; é registrada pela **recepção**.
- REGRA DEFINIDA: validação de estoque físico fora do escopo do MVP (não há controle de estoque).

**DECISÃO INSTITUCIONAL PENDENTE (Sprint 01):**
- Limite máximo de vales por paciente por período
- Paciente pode possuir mais de uma liberação ativa simultaneamente?

**Múltiplas liberações simultâneas (RESOLVIDO parcialmente — Sprint 05):** a documentação **não define** se um paciente pode ter mais de uma liberação ativa. Decisão: **sem constraint de unicidade** — o modelo suporta N liberações por paciente; se a regra "uma ativa por vez" for aprovada, será validação de serviço, não do banco. **DECISÃO INSTITUCIONAL PENDENTE.**

### Retirada
Ato de o paciente retirar os vales na recepção, apresentando a autorização; a entrega é registrada naquele momento.

**Atributos:**
- Liberação associada
- Paciente que retirou (somente o próprio paciente)
- Recepcionista que registrou a retirada
- Quantidade entregue
- Data/hora da retirada

**Regras de negócio:**
- Retirada ocorre na recepção
- Sistema deve registrar a retirada
- Retirada é sempre registrada contra uma liberação específica
- **Retirada somente pelo próprio paciente — terceiros NÃO permitidos (RN24)**
- Quantidade entregue não pode exceder a quantidade autorizada da liberação
- Não há saldo acumulado entre liberações (RN22)

**DECISÃO TÉCNICA (Sprint 01):**
- Quantidade não entregue de uma liberação = quantidade autorizada − quantidade entregue (controle por liberação, sem acúmulo entre liberações).

**DECISÃO INSTITUCIONAL PENDENTE (Sprint 01):**
- Retirada parcelada (ex.: liberou 8, retira 4 hoje e 4 depois)?
- Quantidade de uma retirada deve ser restrita a 1, 2, 4 ou 8 ou pode ser qualquer valor até o autorizado?
- Comprovante de retirada impresso ou digital?

**Regras conceituais da retirada (RESOLVIDO — Sprint 05):** o total retirado é calculado pela **soma das retiradas** da liberação; a **quantidade restante** por liberação = autorizada − soma retirada (controle técnico). **Não há saldo acumulado entre liberações (RN22)**. Quando a quantidade autorizada é totalmente retirada, o sistema impede novas retiradas; a liberação permanece ativa até o fim da validade. Parcelamento e quantidade da retirada permanecem **DECISÃO INSTITUCIONAL PENDENTE** (nenhuma regra é inventada).

### Vale
Unidade individual de vale-transporte.

**Características:**
- Valor unitário fixo (não gerenciado pelo sistema)
- Quantidades controladas: 1, 2, 4, 8 por liberação
- Não há rastreamento individual de cada vale (lote por liberação)

**Decisões (Sprint 01):**
- REGRA DEFINIDA: no MVP, os vales são controlados como quantidade por liberação (1, 2, 4, 8), sem rastreamento individual.

**DECISÃO INSTITUCIONAL PENDENTE:** necessidade de controlar numeração/série dos vales físicos (implicaria em entidade `vale` e mudança de modelagem).

### Tipo de Liberação
Classificação da liberação em duas categorias mutuamente exclusivas:

1. **Contínua**: válida por período determinado de **1, 3 ou 6 meses** (definido no ato da liberação). Após o vencimento, é necessária nova liberação/renovação.
2. **Avulsa**: para necessidade pontual, única, sem renovação. Validade de **1 dia**.

**Decisões (Sprint 03):**
- REGRA DEFINIDA (RN13): liberação contínua com período de 1, 3 ou 6 meses.
- REGRA DEFINIDA (RN21): liberação avulsa com validade de 1 dia.
- REGRA DEFINIDA (RN23): renovação é nova liberação registrada ao término do período anterior, mantendo o profissional autorizador identificado.

**DECISÃO INSTITUCIONAL PENDENTE:**
- Critérios de concessão de cada tipo

### Auditoria
Registro imutável de ações relevantes no sistema.

**Atributos mínimos (confirmados):**
- Usuário que realizou a ação (identificação via autenticação)
- Ação realizada (ex: "Liberação criada", "Retirada registrada", "Paciente cadastrado")
- Data/hora (timestamp)
- Registro afetado (identificador e tipo da entidade)
- Dados anteriores e posteriores (para alterações)

**Princípio:** Funciona como assinatura eletrônica/auditoria baseada na autenticação do usuário.

**Decisões (Sprint 01):**
- REGRA DEFINIDA: ações críticas são obrigatoriamente auditadas — criação/alteracão/cancelamento de liberação; registro/cancelamento de retirada; cadastro/alteracão/inativação de paciente; administração de usuários. Ações comuns (leituras/listagens) não são auditadas por padrão (ver `AUDIT.md`).

**Decisões (Sprint 03):**
- REGRA DEFINIDA (RN28): a auditoria deve distinguir claramente **quem autorizou**, **quem registrou**, **quem realizou a retirada** e a **data/hora** de cada ação (ver `AUDIT.md`).

**DECISÃO INSTITUCIONAL PENDENTE:**
- Auditoria de leitura/consulta a dados sensíveis (LGPD)
- Retenção dos logs: prazo legal, arquivamento
- Imutabilidade técnica: append-only, hash chain, WORM storage?


### Resumo de Vales (Relatórios — Sprint 40)

A aba **Resumo** de /dashboard/relatorios (exclusiva do Gestor ativo) agrega dados já
existentes — sem nova estrutura no banco. Semântica do período:

- **AUTORIZADO**: liberações cuja data_inicio está dentro do período selecionado;
- **RETIRADO**: retiradas cuja data_hora está dentro do período selecionado (conjunto
  independente do anterior — uma retirada contra liberação iniciada antes do período conta
  no período em que ocorreu);
- **SALDO**: sempre derivado = autorizado − retirado. Nunca armazenado.

A UI declara explicitamente essa semântica para evitar interpretações mistas dos totais.

## Relacionamentos entre Entidades

```
Usuário (1) ───< (N) Liberação          // Profissional autorizador
Usuário (1) ───< (N) Liberação          // Recepcionista que registrou a renovação
Paciente (1) ───< (N) Liberação          // Beneficiário
Liberação (1) ───< (N) Retirada          // Uma liberação pode ter múltiplas retiradas (parcelamento a confirmar)
Liberação (1) ───< (N) Liberação         // Renovação referencia a liberação anterior (RN23)
Usuário (1) ───< (N) Retirada            // Recepcionista que registrou
Paciente (1) ───< (N) Retirada           // Somente o próprio paciente retira (RN24)
Auditoria (N) ───< (1) Entidade Afetada  // Log referencia qualquer entidade
```

## Regras de Negócio Conhecidas (Consolidadas)

| Regra | Descrição |
|-------|-----------|
| RN01 | Apenas pacientes com direito ativo podem receber vales |
| RN02 | Liberação só pode ser feita por: Assistente Social, Psicólogo, Terapeuta Ocupacional |
| RN03 | Profissional autorizador deve ser identificado na liberação |
| RN04 | Quantidade de vales por liberação: apenas 1, 2, 4 ou 8 |
| RN05 | Dois tipos de liberação: contínua ou avulsa (mutuamente exclusivos) |
| RN06 | Retirada ocorre na recepção e deve ser registrada |
| RN07 | Todo usuário deve estar autenticado |
| RN08 | Toda ação relevante gera log de auditoria |
| RN09 | Log deve conter: usuário, ação, data/hora, registro afetado |
| RN10 | Log funciona como assinatura eletrônica/auditoria |
| RN11 | Relatórios com filtros: período, usuário, paciente, tipo, quantidade, retiradas |
| RN12 | Histórico preservado mesmo após alteração de dados cadastrais |
| RN13 | Liberação contínua: válida por período determinado de 1, 3 ou 6 meses; nova liberação/renovação após o vencimento |
| RN14 | Retirada registrada contra uma liberação específica; não pode exceder a quantidade autorizada |
| RN15 | Sistema controla somente a movimentação registrada de vales; sem controle de estoque físico no MVP |
| RN16 | Quantidade da retirada é inteira positiva, limitada à quantidade restante da liberação (restrição a 1/2/4/8 na retirada: DECISÃO INSTITUCIONAL PENDENTE — Sprint 05) |
| RN17 | MVP é exclusivo de uma unidade (CAPS 3); modelagem prevê expansão futura sem multi-tenant complexo |
| RN18 | Liberação somente por Profissional Autorizador; retirada e renovação pela Recepcionista; administração de usuários pelo Gestor |
| RN19 | Ações críticas são obrigatoriamente auditadas (ver `AUDIT.md`) |
| RN20 | Minimização de dados: coletar apenas dados necessários ao funcionamento (LGPD) |
| RN21 | Liberação avulsa: validade de 1 dia |
| RN22 | Não há saldo acumulado entre liberações; autorização apresentada na retirada e entrega registrada naquele momento |
| RN23 | Renovação: nova liberação ao término do período anterior, mantendo o profissional autorizador; registrada pela recepção com log |
| RN24 | Retirada somente pelo próprio paciente; retirada por terceiros NÃO permitida |
| RN25 | Identificação principal do paciente: Gestor SUS; CPF também armazenado |
| RN26 | Perfis do MVP: Profissional Autorizador, Recepcionista, Gestor (Auditor fora do MVP) |
| RN27 | Profissional autorizador deve ter cadastro ativo; inativo não autoriza; alertas claros para inativos |
| RN28 | Auditoria distingue quem autorizou, quem registrou, quem retirou e a data/hora de cada ação |
| RN29 | Origem do paciente (`regular`/`esporadico`): gestor e autorizador cadastram regulares; recepcionista cadastra somente esporádicos; paciente esporádico recebe SOMENTE liberação avulsa (Sprint 38) |

## Fechamento Sprint 01 — Decisões Consolidadas

### REGRA DEFINIDA (confirmada)

- **Liberação contínua:** válida por período determinado de **1, 3 ou 6 meses**; nova liberação/renovação após o vencimento (RN13).
- **Liberação avulsa:** validade de **1 dia** (RN21).
- **Saldo:** não há saldo acumulado entre liberações (RN22).
- **Retirada:** sempre registrada contra uma liberação específica; não excede a quantidade autorizada; **somente o próprio paciente retira** (RN24).
- **Estoque:** o sistema controla somente a movimentação registrada (liberações e retiradas). Não há controle de estoque físico no MVP.
- **Vales:** sem rastreamento individual no MVP (quantidade por liberação).
- **Unidade:** MVP exclusivo para o CAPS 3; sem multi-CAPS.
- **Minimização de dados:** coletar apenas os dados necessários ao funcionamento (LGPD).
- **Perfis do MVP:** Profissional Autorizador, Recepcionista, Gestor (Auditor fora do MVP).
- **Identificação do paciente:** Gestor SUS como identificador principal + CPF armazenado (RN25).
- **Profissional ativo:** cadastro ativo obrigatório; inativo não autoriza; alertas claros (RN27).

### DECISÃO TÉCNICA

- **Quantidade não entregue por liberação:** cálculo derivado (quantidade autorizada − soma das retiradas); **sem acúmulo entre liberações** (RN22).
- **Expansão futura:** a modelagem prevê campo de unidade nas entidades operacionais, sem complexidade de multi-tenant no MVP.
- **Numeração de vales:** sem rastreamento individual enquanto não houver controle de estoque físico.

### Matriz de Permissões (perfil × ação) — MVP (Sprint 03)

| Ação | Prof. Autorizador | Recepcionista | Gestor |
|---|---|---|---|
| Cadastrar paciente regular | Sim | Não (Sprint 38) | Sim |
| Cadastrar paciente esporádico | Não | Sim — somente avulsas (RN29, Sprint 38) | Não |
| Alterar dados/status do paciente | Alterar dados | Não | Status |
| Consultar paciente | Sim (sem CPF) | Sim (sem CPF) | Sim (com CPF) |
| Criar liberação | Sim (profissões habilitadas e cadastro ativo) | Não | Não |
| Registrar renovação | Não | Sim (mantendo profissional autorizador) | Não |
| Alterar/cancelar liberação | PENDENTE | Não | PENDENTE |
| Registrar retirada | Não | Sim | Não |
| Consultar retiradas | Não | Sim | Sim |
| Consultar relatórios | PENDENTE | Não | Sim |
| Consultar logs de auditoria | Não | Não | Sim |
| Administrar usuários | Não | Não | Sim |

> Auditor (somente leitura de logs) está fora do MVP — perfil futuro.
> Consultar paciente pelo Recepcionista é necessário para registrar retiradas/renovações.
> **Menor privilégio (Sprint 05):** CPF do paciente visível apenas ao Gestor; retiradas não visíveis ao Autorizador; usuários e auditoria (dados administrativos) restritos ao Gestor (ver `SECURITY.md`).

## DECISÕES INSTITUCIONAIS CRÍTICAS (Sprint 01.1)

> Seção de validação (Sprints 02–03): os pontos que bloqueavam a modelagem foram respondidos pela gestão/equipe do CAPS 3 e consolidados como **REGRA DEFINIDA** (itens 1–4, 8, 10–12). Itens marcados como **VALIDADA (Sprint 03)**. Permanecem pendentes os itens 5 (retirada parcelada), 6 (múltiplas liberações ativas), 7 (quantidades na retirada) e 9 (comprovante) — nenhum bloqueia a modelagem.

### 1. Liberação contínua — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** a liberação contínua inicia no registro pelo profissional autorizador. Impacto: campos de data na entidade `liberacoes`; lógica de validade das retiradas; relatórios.

**REGRA DEFINIDA (RN13):** a liberação contínua é **válida por período determinado de 1, 3 ou 6 meses** (definido no ato da liberação). Após o vencimento, é necessária uma **nova liberação/renovação** (RN23).

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

### 2. Liberação avulsa — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** avulsa é pontual, única e sem renovação. Impacto: controle de expiração; retiradas.

**REGRA DEFINIDA (RN21):** a liberação avulsa tem **validade de 1 dia**.

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

### 3. Validade das liberações — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** não havia definição sobre saldo não retirado. Impacto: retiradas, expiração.

**REGRA DEFINIDA (RN22):** **não existe saldo acumulado de liberações anteriores**. A autorização é apresentada no momento da retirada e a entrega é registrada naquele momento.

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

### 4. Renovação — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** não definida. Impacto: fluxo de novas liberações; auditoria.

**REGRA DEFINIDA (RN23):** a renovação é uma **nova liberação registrada quando o período anterior termina**, mantendo identificado o **profissional autorizador**; é registrada pela **recepção**; deve existir log identificando **usuário da recepção, data/hora e profissional autorizador**.

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

### 5. Retirada parcelada

- **Situação atual conhecida:** retiradas são vinculadas a uma liberação; saldo = liberado − retirado (RN14, RN16). O parcelamento não foi autorizado.
- **Decisão necessária:** uma liberação de 8 pode ser retirada em parcelas (ex.: 4 hoje e 4 depois)?
- **Impacto no sistema:** a modelagem já suporta múltiplas retiradas por liberação; a decisão define se haverá restrição.
- **Opções possíveis:**
  1. Permitido — múltiplas retiradas até zerar o saldo.
  2. Retirada única por liberação (bloquear nova retirada se já houver uma).
- **DECISÃO INSTITUCIONAL PENDENTE.**
- **Bloqueia modelagem: NÃO** (mudança de regra/validação; a estrutura de `retiradas` já comporta as duas opções).
- **Sprint 05:** regra conceitual definida — total retirado = soma; quantidade restante = autorizada − soma; bloqueio quando esgotada; parcelamento em si permanece PENDENTE (nada inventado).

### 6. Múltiplas liberações ativas

- **Situação atual conhecida:** não definido se um paciente pode ter mais de uma liberação ativa simultânea.
- **Decisão necessária:** um paciente pode ter mais de uma liberação ativa ao mesmo tempo?
- **Impacto no sistema:** restrição de unicidade; fluxo da recepção (qual liberação usar na retirada); relatórios.
- **Opções possíveis:**
  1. Permitido — a retirada indica a liberação de origem.
  2. Apenas uma ativa por paciente — bloquear nova liberação enquanto houver saldo.
- **DECISÃO INSTITUCIONAL PENDENTE.**
- **Bloqueia modelagem: PARCIAL** (restrição de unicidade no banco; pode ser aplicada depois).
- **Sprint 05:** **sem constraint de unicidade** — o modelo permite N liberações por paciente; se a regra "uma ativa por vez" for aprovada, será validação de serviço (ver `DATABASE.md`).

### 7. Quantidades permitidas na retirada

- **Situação atual conhecida:** liberação restrita a 1, 2, 4, 8 (RN04); a retirada é inteira positiva, limitada ao saldo (RN16), sem restrição aos mesmos valores.
- **Decisão necessária:** a quantidade de uma retirada deve ser restrita a 1, 2, 4, 8 ou pode ser qualquer valor até o saldo?
- **Impacto no sistema:** validação de entrada; formulário de retirada; parcelas possíveis.
- **Opções possíveis:**
  1. Qualquer inteiro de 1 até o saldo.
  2. Apenas 1, 2, 4 ou 8.
- **DECISÃO INSTITUCIONAL PENDENTE.**
- **Bloqueia modelagem: NÃO** (regra de validação, não estrutural).
- **Sprint 05:** a validação conceitual é "inteiro positivo ≤ quantidade restante da liberação"; a restrição a 1/2/4/8 na retirada permanece PENDENTE (ver `DATABASE.md`).

### 8. Retirada por terceiros — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** a retirada é registrada contra uma liberação. Impacto: campos adicionais na entidade `retiradas`; auditoria.

**REGRA DEFINIDA (RN24):** retirada por terceiros **NÃO é permitida**; a retirada ocorre somente pelo **próprio paciente**.

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

### 9. Comprovante de retirada

- **Situação atual conhecida:** não definido.
- **Decisão necessária:** será emitido comprovante de retirada? Impresso, digital, com assinatura/confirmação?
- **Impacto no sistema:** armazenamento de comprovantes; tela de impressão; confirmação do paciente.
- **Opções possíveis:**
  1. Sem comprovante.
  2. Comprovante impresso.
  3. Comprovante digital com confirmação na tela.
- **DECISÃO INSTITUCIONAL PENDENTE.**
- **Bloqueia modelagem: NÃO** (pode ser adicionado depois via Storage/documentos).

### 10. Cadastro e identificação do paciente — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** campos mínimos — identificador, nome, CPF, status do direito, datas de acompanhamento. Minimização de dados (RN20). Impacto: estrutura da tabela `pacientes`; LGPD; permissões.

**REGRA DEFINIDA (RN25):** o **identificador principal** do paciente é o número do **Gestor SUS**; o **CPF** também é armazenado.

**REGRA DEFINIDA (RN29 — Sprint 38):** todo paciente possui uma **origem** (`origem_paciente`: `regular` | `esporadico`). Paciente **esporádico** é cadastrado exclusivamente pela recepção para atendimento pontual e **somente pode receber liberação avulsa** (nunca contínua). A regra é garantida no banco (trigger `fn_liberacoes_before`), não apenas na UI. Pacientes regulares são cadastrados por Gestor ou profissional autorizador.

**PENDENTE (parcial):** campos adicionais além dos mínimos.

**Status: VALIDADA — REGRA DEFINIDA (identificação e origem).**
**Bloqueia modelagem: RESOLVIDO (identificação e origem).**

### 11. Perfis e permissões — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** perfis mínimos e matriz de permissões com pendências. Impacto: tabelas de perfis/permissões; políticas RLS.

**REGRA DEFINIDA (RN26):** perfis do **MVP** — **Profissional Autorizador, Recepcionista e Gestor**. **Auditor está fora do MVP**.
**REGRA DEFINIDA (RN23):** a recepção registra **renovações** (nova liberação mantendo o profissional autorizador).

**PENDENTE (perguntas em aberto):**
1. A recepção pode cadastrar/alterar pacientes? — **PARCIALMENTE RESOLVIDO (Sprint 38):** a recepção cadastra **somente pacientes esporádicos** (origem `esporadico`, apenas liberação avulsa — RN29); alteração de dados e status de pacientes continua exclusiva do autorizador/gestor.
2. Profissionais autorizadores podem consultar relatórios? — PENDENTE.
3. Quem pode alterar/cancelar liberações? — PENDENTE.

**Status: VALIDADA (perfis) — com pendências parciais.**
**Bloqueia modelagem: RESOLVIDO (perfis) — pendências de permissão não estruturais.**

### 12. Validação do profissional autorizador — VALIDADA (Sprint 03)

**Contexto (documentado na Sprint 01.1):** apenas Assistente Social, Psicólogo e Terapeuta Ocupacional podem liberar (RN02). Impacto: cadastro de usuários; validação no fluxo de liberação.

**REGRA DEFINIDA (RN27):** o profissional autorizador deve possuir **cadastro ativo**; profissional **inativo não pode autorizar** novas liberações; o sistema deve exibir **alertas claros** para profissionais inativos.

**Status: VALIDADA — REGRA DEFINIDA.**
**Bloqueia modelagem: RESOLVIDO.**

## DECISÕES INSTITUCIONAIS PENDENTES (atualizado Sprint 05)

1. **Retirada parcelada** - permitida? Regras?
2. **Quantidade de retirada** - restrita a 1, 2, 4, 8 ou qualquer valor até o autorizado?
3. **Múltiplas liberações ativas** - paciente pode ter mais de uma simultaneamente?
4. **Limite de vales por paciente/período** - existe teto?
5. **Comprovante de retirada** - impresso, digital, confirmação do paciente?
6. **Cadastro de pacientes pela recepção** — **RESOLVIDO (Sprint 38):** a recepção cadastra exclusivamente pacientes esporádicos (origem `esporadico`, somente liberação avulsa — RN29); alteração de dados de pacientes permanece com o autorizador; status com o Gestor.
7. **Relatórios para profissionais autorizadores** - podem consultar relatórios?
8. **Quem pode alterar/cancelar liberações** - autorizador da liberação, qualquer autorizador, Gestor?
9. **Campos adicionais do paciente** - além de Gestor SUS, nome e CPF.
10. **Estoque físico** - se o CAPS desejar controlar entrada/saída/saldo físico (fora do MVP).
11. **Numeração/série dos vales físicos** - se o sistema deve controlar.
12. **Auditoria de leitura de dados sensíveis** - logar consultas (LGPD)?
13. **Retenção legal de dados e logs** - prazo, arquivamento.
14. **Criação de usuários** - fluxo (auto-cadastro, convite, admin), SSO, MFA.
15. **Validação de conselho profissional** - além do vínculo ativo, registro no conselho.
16. **Integração com outros sistemas** - prontuário, RH, financeiro, transporte.
17. **Importação/migração** - dados legados de planilhas/sistemas antigos.
18. **Profissional inativo na renovação** - procedimento quando o profissional da liberação anterior estiver inativo no momento da renovação (bloquear / nova autorização de outro ativo / autorização prévia). **DECISÃO INSTITUCIONAL PENDENTE — Sprint 05.**

## RESOLVIDO — Sprint 05

1. **`pode_autorizar`** — removido; capacidade derivada de `perfil + profissao + status_ativo` (RN27).
2. **CPF opcional** — NOT NULL não aplicado; obrigatoriedade permanece pendente.
3. **Renovação × profissional inativo** — papéis distintos documentados (autorizou / autoriza nova / registrou); histórico preserva autorizador original (RN12); inativo não autoriza novas liberações (RN27).
4. **Retiradas** — total por soma; quantidade restante por liberação; sem saldo acumulado (RN22); bloqueio quando esgotada.
5. **Múltiplas liberações** — sem constraint de unicidade (a definir em serviço se aprovada).