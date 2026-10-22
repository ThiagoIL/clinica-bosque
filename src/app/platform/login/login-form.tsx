"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { platformLogin } from "../actions";

export function PlatformLoginForm() {
  return (
    <ActionForm action={platformLogin} className="space-y-4">
      <TextField name="email" label="E-mail" type="email" autoComplete="username" required />
      <TextField name="password" label="Senha" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full">Entrar</SubmitButton>
    </ActionForm>
  );
}
