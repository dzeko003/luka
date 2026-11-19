import { z } from "zod";
import { db, schema } from "@/db";
import { userExists } from "@/lib/admin-stats";
import { apiConsoleAdmin, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  amount: z.number().int().positive().max(100_000_000),
  method: z.enum(["mobile_money", "especes", "virement", "autre"]),
  note: z.string().trim().max(200).optional(),
});

/** Administration : enregistrer un paiement reçu d'un utilisateur (revenus). */
export async function POST(req: Request, { params }: Ctx) {
  const admin = await apiConsoleAdmin();
  if (!admin) return jsonError("Introuvable", 404);
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Montant ou moyen de paiement invalide.");
  if (!(await userExists(id))) return jsonError("Utilisateur introuvable", 404);
  const [p] = await db
    .insert(schema.payments)
    .values({ userId: id, amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note || null, createdBy: admin.id })
    .returning({ id: schema.payments.id });
  return Response.json(p, { status: 201 });
}
