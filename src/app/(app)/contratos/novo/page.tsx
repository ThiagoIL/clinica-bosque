import { db } from "@/lib/db";
import { Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { ContractForm } from "../contract-form";

export const metadata = { title: "Novo contrato" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const collaborators = await db.collaborator.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Novo contrato"
        description="Anexe o contrato assinado já no cadastro (opcional); também é possível anexar depois."
        back={{ href: "/contratos", label: "Contratos" }}
      />
      {collaborators.length === 0 ? (
        <EmptyState
          title="Cadastre um colaborador primeiro"
          description="Todo contrato pertence a um colaborador."
          action={<LinkButton href="/colaboradores?edit=new">Novo colaborador</LinkButton>}
        />
      ) : (
        <Card>
          <ContractForm collaborators={collaborators} defaultCollaboratorId={param((await searchParams).collaborator)} />
        </Card>
      )}
    </>
  );
}
