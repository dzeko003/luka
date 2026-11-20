import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ContributeForm } from "@/components/contribute-form";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Contribuer" };

export default async function Page() {
  const user = await requireUser();
  const c = schema.contributions;
  const mine = await db
    .select({
      id: c.id,
      title: c.title,
      city: c.city,
      rowCount: c.rowCount,
      status: c.status,
      added: c.added,
      updated: c.updated,
      reviewNote: c.reviewNote,
      createdAt: c.createdAt,
    })
    .from(c)
    .where(eq(c.userId, user.id))
    .orderBy(desc(c.createdAt))
    .limit(50);
  return <ContributeForm mine={mine.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />;
}
