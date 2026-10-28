"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Camera, Loader2, User } from "lucide-react";
import type { FormState } from "@/lib/form";
import { removePatientPhoto, savePatientPhoto } from "./actions";

/** Foto do paciente: clique no ícone da câmera para enviar uma nova; "remover" apaga. */
export function PatientPhotoButton({ patientId, hasPhoto, version }: { patientId: string; hasPhoto: boolean; version: number }) {
  const [saveState, save, saving] = useActionState(savePatientPhoto, {} as FormState);
  const [removeState, remove, removing] = useActionState(removePatientPhoto, {} as FormState);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const error = saveState.error ?? removeState.error;
    if (error) window.alert(error);
  }, [saveState, removeState]);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("id", patientId);
    data.set("photo", file);
    startTransition(() => save(data));
    if (input.current) input.current.value = "";
  }

  function onRemove() {
    if (!window.confirm("Remover a foto do paciente?")) return;
    const data = new FormData();
    data.set("id", patientId);
    startTransition(() => remove(data));
  }

  const busy = saving || removing;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-24">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-line">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/pacientes/foto/${patientId}?v=${version}`} alt="Foto do paciente" className="size-full object-cover" />
          ) : (
            <User className="size-12 text-muted" />
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          title={hasPhoto ? "Trocar foto" : "Adicionar foto"}
          aria-label={hasPhoto ? "Trocar foto" : "Adicionar foto"}
          className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-line bg-surface text-brand-700 shadow-xs hover:bg-brand-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>
      {hasPhoto && (
        <button type="button" onClick={onRemove} disabled={busy} className="text-xs text-muted hover:text-red-600 hover:underline">
          remover foto
        </button>
      )}
    </div>
  );
}
