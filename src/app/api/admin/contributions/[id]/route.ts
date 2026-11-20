import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiConsoleAdmin, jsonError } from "@/lib/api";
import { upsertEntities } from "@/lib/kb";
import { notify } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() });

/** Modération d'une contribution : approuvée, ses lignes rejoignent la base Luka ; rejetée, elle n'y entre pas. */
export async function POST(req: Request, { params }: Ctx) {
  const admin = await apiConsoleAdmin();
  if (!admin) return jsonError("Accès refusé", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Contribution introuvable", 404);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Données invalides");
  const { action, note } = parsed.data;

  const [c] = await db.select().from(schema.contributions).where(eq(schema.contributions.id, id));
  if (!c) return jsonError("Contribution introuvable", 404);
  if (c.status !== "pending") return jsonError("Cette contribution a déjà été traitée");

  // La contribution est réservée avant l'ingestion : deux clics ne l'ajoutent pas deux fois
  const [claimed] = await db
    .update(schema.contributions)
    .set({ status: action === "approve" ? "approved" : "rejected", reviewNote: note || null, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(and(eq(schema.contributions.id, id), eq(schema.contributions.status, "pending")))
    .returning({ id: schema.contributions.id });
  if (!claimed) return jsonError("Cette contribution a déjà été traitée");

  if (action === "reject") {
    await notify(c.userId, { title: `Contribution non retenue : ${c.title}`, body: note || "Elle ne correspond pas aux critères de la base Luka.", href: "/contribuer" });
    return Response.json({ status: "rejected" });
  }

  const { added, updated } = await upsertEntities(
    c.rows.map((r) => ({ fields: r, city: c.city, category: c.category })),
    "contribution",
  );
  await db.update(schema.contributions).set({ added, updated }).where(eq(schema.contributions.id, id));
  await notify(c.userId, {
    title: `Merci ! Contribution acceptée : ${c.title}`,
    body: `${added} établissement(s) ajouté(s) et ${updated} complété(s) dans la base Luka.`,
    href: "/contribuer",
  });
  return Response.json({ status: "approved", added, updated });
}
