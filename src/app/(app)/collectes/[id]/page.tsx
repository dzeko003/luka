import { notFound } from "next/navigation";
import { CollecteView } from "@/components/collecte-view";
import { getOwnedCollecte } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export default async function Page({ params }: PageProps<"/collectes/[id]">) {
  const user = await requireUser();
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) notFound();
  return <CollecteView id={c.id} />;
}
