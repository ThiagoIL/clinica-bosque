import { Brain } from "lucide-react";

/** Cérebro que identifica o atendimento/lançamento de paciente ABA. */
export function AbaIcon({ className = "size-3.5" }: { className?: string }) {
  return <Brain className={className} aria-label="Paciente ABA" role="img" />;
}

/** Etiqueta "ABA" com o cérebro, para listas e cabeçalhos. */
export function AbaBadge() {
  return (
    <span className="badge bg-violet-100 text-violet-800" title="Paciente ABA">
      <AbaIcon className="size-3.5" /> ABA
    </span>
  );
}
