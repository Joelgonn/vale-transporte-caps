# Relatórios - Vale Transporte CAPS

> Documento de requisitos. **Nenhum relatório será implementado nesta Sprint.**

> **Sprint 05:** relatórios que exibem dados de pacientes respeitam a visibilidade por perfil (ver `SECURITY.md`) — **CPF apenas para o Gestor**; Autorizador e Recepcionista não visualizam CPF.

## Objetivos dos Relatórios

Permitir **visão consolidada** da operação do Vale-Transporte Social do CAPS, para:
- Gestão do benefício (quem recebeu, quanto, quando).
- Prestação de contas e fiscalização.
- Auditoria do processo de liberação e retirada.
- Apoio à tomada de decisão (volume, demanda, tendências).

## Filtros Previstos (RN11) — Validados na Sprint 01

Os filtros definidos foram **confirmados** como suficientes para o MVP:

1. **Período/data** — intervalo de datas (liberação e/ou retirada).
2. **Usuário/profissional** — quem autorizou ou quem registrou a retirada.
3. **Paciente** — paciente específico ou grupo.
4. **Tipo de liberação** — contínua ou avulsa.
5. **Quantidade** — quantidade de vales (1, 2, 4, 8).
6. **Retiradas** — com/sem retirada, retiradas no período, pendências de retirada dentro da validade (sem saldo acumulado — RN22).

## Relatórios Essenciais do MVP (Sprint 01, atualizado Sprint 03)

1. **Relatório de Liberações** — por período, com filtros de profissional, paciente, tipo (contínua/avulsa), quantidade e período de validade.
2. **Relatório de Retiradas** — por período, com filtros de recepcionista e paciente.
3. **Histórico por Paciente** — liberações, renovações e retiradas de um paciente específico.
4. **Consolidado Autorizado vs. Entregue** — totais de vales autorizados vs. efetivamente entregues por período.
5. **Relatório de Renovações** — renovações registradas, com usuário da recepção, data/hora e profissional autorizador (RN23).
6. **Relatório de Auditoria** — logs de ações por período, usuário e ação (acesso restrito; distingue autorizou/registrou/retirou — RN28).

> **Não há saldo acumulado entre liberações (RN22):** não existe "saldo não retirado" transferível. Liberações autorizadas sem retirada dentro do período de validade expiram; o acompanhamento desse caso fica no relatório de pendências de retirada dentro da validade.
>
> **Total retirado (Sprint 05):** o total efetivamente entregue de uma liberação = **soma das retiradas** registradas; quantidade restante por liberação = autorizada − soma (controle técnico, ver `DATABASE.md`).
> **Sprint 44 — Glossário oficial** (`lib/domain/relatorios/glossario.ts`): RESUMO `Previsto` (liberações com data_inicio no período) / `Retirado` (retiradas com data_hora no período, independente) / `Diferença` (Previsto−Retirado); CONSOLIDADO/HISTÓRICO `Previsto` (previsão da liberação) / `Retirado` (acumulado) / `Diferença`; LIBERAÇÕES `Previsto`+`Retirado` por liberação; RETIRADAS `Quantidade` individual. Convenção `1 mês = 4 semanas`.
> **Sprint 44 — Histórico** preparado para `Estado atual + Eventos` via `auditoria_logs` (sem segunda trilha) — `lib/domain/relatorios/eventos.ts`.

## Relatórios Planejados

### Por Período
- Resumo de liberações, renovações e retiradas em um intervalo de datas.
- Evolução temporal (volume por mês/semana) — se aplicável.

### Por Usuário/Profissional
- Total de liberações por profissional autorizador.
- Total de retiradas por recepcionista.

### Por Paciente
- Histórico de liberações e retiradas de um paciente.
- Pacientes com direito ativo, com liberação pendente de retirada.

### Sobre Liberações
- Por tipo (contínua / avulsa).
- Por quantidade de vales (1, 2, 4, 8).
- Canceladas e válidas no período.

### Sobre Retiradas
- Retiradas realizadas no período.
- Liberações autorizadas sem retirada dentro do período de validade (pendências dentro da validade — RN22; sem saldo acumulado).

### Consolidações
- Totais de vales liberados vs. retirados.
- Média/tendências de uso.
- **DECISÃO PENDENTE:** indicadores/gráficos específicos exigidos pela gestão.

## Exportações Futuras (Fase posterior)

- **PDF** — relatórios formatados para impressão/fiscalização.
- **Excel (XLSX)** — dados tabulares para análise.
- **CSV** — dados abertos para integração/análise externa.

> Apenas planejado. **Não implementar agora.** Ferramenta de exportação: DECISÃO PENDENTE.

## Consistência com a Auditoria

- Relatórios devem ser **fieis ao histórico auditado**, não apenas ao dado operacional corrente (RN12).
- Consultas sensíveis a dados de pacientes devem respeitar autorização por perfil (ver `SECURITY.md`).

## Restrições

- Acesso restrito a perfis autorizados (Gestor; profissionais autorizadores — DECISÃO INSTITUCIONAL PENDENTE).
- Exportação (PDF/Excel/CSV) **não** faz parte do MVP.
- Sem implementação nesta Sprint.
