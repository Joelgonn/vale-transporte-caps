import {
  ROTULO_STATUS_LIBERACAO,
  STATUS_LIBERACAO,
  type StatusLiberacao,
} from "@/lib/domain/enums";
import { BADGE_ERRO, BADGE_NEUTRO, BADGE_SUCESSO } from "@/components/ui/visual-tokens";

const CORES: Record<StatusLiberacao, string> = {
  [STATUS_LIBERACAO.ATIVA]: BADGE_SUCESSO,
  [STATUS_LIBERACAO.EXPIRADA]: BADGE_NEUTRO,
  [STATUS_LIBERACAO.CANCELADA]: BADGE_ERRO,
};

export function LiberacaoStatus({ status }: { status: StatusLiberacao }) {
  const rotulo = ROTULO_STATUS_LIBERACAO[status] ?? status;
  const cor = CORES[status] ?? CORES[STATUS_LIBERACAO.EXPIRADA];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}
    >
      {rotulo}
    </span>
  );
}