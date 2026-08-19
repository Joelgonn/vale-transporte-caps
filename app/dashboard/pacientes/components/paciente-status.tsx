// app/dashboard/pacientes/components/paciente-status.tsx
import { STATUS_PACIENTE, type StatusPaciente } from "@/lib/domain/enums";
import {
  BADGE_SUCESSO,
  BADGE_ERRO,
  BADGE_NEUTRO,
} from "@/components/ui/visual-tokens";

// Mapeamento de status para badges (somente os status canônicos do contrato:
// ATIVO/INATIVO — ver lib/domain/enums.ts e a migration de pacientes).
const CORES: Record<StatusPaciente, string> = {
  [STATUS_PACIENTE.ATIVO]: BADGE_SUCESSO,
  [STATUS_PACIENTE.INATIVO]: BADGE_ERRO,
};

// Rótulos legíveis para cada status (projeção dos enums canônicos na UI).
const ROTULOS: Record<StatusPaciente, string> = {
  [STATUS_PACIENTE.ATIVO]: "ATIVO",
  [STATUS_PACIENTE.INATIVO]: "INATIVO",
};

interface PacienteStatusProps {
  status: StatusPaciente;
  children?: React.ReactNode;
  className?: string;
}

export function PacienteStatus({
  status,
  children,
  className = "",
}: PacienteStatusProps) {
  const badgeClass = CORES[status] || BADGE_NEUTRO;
  const rotulo = children || ROTULOS[status] || status;

  return (
    <span className={`${badgeClass} ${className}`}>
      {rotulo}
    </span>
  );
}
