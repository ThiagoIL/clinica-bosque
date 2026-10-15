"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/ui/form-kit";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={login} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" label="E-mail" type="email" autoComplete="username" required />
      <TextField name="password" label="Senha" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full">Entrar</SubmitButton>
    </ActionForm>
  );
}
