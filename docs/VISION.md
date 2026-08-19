# Visão do Produto - Vale Transporte CAPS

## Propósito do Sistema

Sistema interno para controle do fornecimento de Vale-Transporte Social de um CAPS (Centro de Atenção Psicossocial), garantindo rastreabilidade, auditoria e conformidade no processo de liberação e retirada dos vales.

## Problema que Resolve

Atualmente o controle de Vale-Transporte Social é feito manualmente ou por planilhas, o que gera:
- Falta de rastreabilidade de quem autorizou e quem retirou
- Dificuldade de auditoria e prestação de contas
- Risco de inconsistências e duplicidades
- Ausência de histórico imutável para fins de fiscalização
- Processo lento e propenso a erros humanos

## Objetivos

1. **Rastreabilidade completa**: Registrar cada liberação e retirada com identificação de profissional autorizador, paciente e recepcionista
2. **Auditoria imutável**: Manter logs que funcionem como assinatura eletrônica de cada ação
3. **Controle de acesso**: Garantir que apenas profissionais autorizados (Assistente Social, Psicólogo, Terapeuta Ocupacional) possam liberar vales
4. **Relatórios consolidados**: Permitir geração de relatórios com filtros múltiplos para gestão e fiscalização
5. **Segurança de dados**: Proteger dados sensíveis de pacientes conforme LGPD
6. **Histórico preservado**: Manter integridade dos dados mesmo quando cadastros forem alterados

## Limites do Sistema

- **Escopo**: Apenas controle de Vale-Transporte Social do CAPS
- **Usuários**: Profissionais do CAPS (autorizadores), recepcionistas, gestores/auditores
- **Integração**: Inicialmente standalone, sem integração com outros sistemas do CAPS
- **Vales**: Controle de quantidades (1, 2, 4, 8) e tipos de liberação (contínua, avulsa)

## O que o Sistema NÃO Pretende Fazer

- Não gerencia outros tipos de benefícios ou auxílios
- Não substitui prontuário eletrônico do paciente
- Não faz gestão financeira ou contábil do CAPS
- Não emite vales físicos (apenas registra a liberação/retirada)
- Não faz agendamento de consultas ou gestão de agenda
- Não substitui sistemas de RH ou folha de pagamento
- Não faz integração automática com sistemas de transporte público
- Não realiza pagamentos ou transferências financeiras