import { Wordmark } from "../logo";

/* Petites briques communes de l'administration (style de la maquette « User management »). */

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const btn = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-2 px-3 text-[13px] font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const btnGhost = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const btnDanger = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-danger-border bg-danger-soft px-3 text-[13px] font-medium text-danger transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const btnSuccess = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-success-border bg-success-soft px-3 text-[13px] font-medium text-success transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const field =
  "h-10 w-full rounded-md border border-border-strong bg-bg px-3 text-[14px] text-text outline-none transition placeholder:text-muted focus:border-focus focus:ring-2 focus:ring-focus/20";
export const fieldLabel = "mb-1.5 block text-[13px] font-medium";
export const alertCls = "rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[13px] text-danger";
export const panel = "rounded-lg border border-border bg-surface";

type Tone = "neutral" | "success" | "danger" | "warn" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border-strong",
  success: "bg-success-soft text-success border-success-border",
  danger: "bg-danger-soft text-danger border-danger-border",
  warn: "bg-warn-soft text-warn border-warn-border",
  info: "bg-info-soft text-info border-info-border",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-[5px] border px-1.5 py-px text-[11.5px] font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

const avatarColors = ["#7c5cff", "#2dd4bf", "#f472b6", "#f59e0b", "#60a5fa", "#a3e635", "#fb7185", "#c084fc"];

export function Avatar({ name, image, size = 24 }: { name: string; image?: string | null; size?: number }) {
  if (image)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo Google, affichée telle quelle
      <img src={image} alt="" aria-hidden="true" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    );
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const color = avatarColors[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % avatarColors.length];
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-[#111113]"
      style={{ width: size, height: size, background: color, fontSize: size > 28 ? 13 : 10 }}
    >
      {initials}
    </span>
  );
}

/** Carte centrée façon fenêtre de dialogue (connexion, activation de la double authentification, confirmations). */
export function DialogCard({
  title,
  subtitle,
  children,
  footer,
  wide,
  as: Heading = "h1",
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={`w-full ${wide ? "max-w-[520px]" : "max-w-[420px]"} overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)]`}
    >
      <div className={children ? "px-5 pt-5" : "p-5"}>
        <Heading className="text-[15px] font-semibold tracking-[-0.01em]">{title}</Heading>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children && <div className="px-5 py-5">{children}</div>}
      {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </div>
  );
}

/** Logo de Luka suivi de la mention « Admin ». */
export function AdminMark({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Wordmark size={size} />
      <span className="rounded border border-border-strong px-1.5 py-px text-[11px] font-medium text-muted">Admin</span>
    </span>
  );
}

/** En-tête d'une page de l'administration. */
export function PageTitle({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
        {title}
        {count !== undefined && (
          <span className="rounded-md border border-border-strong bg-surface-2 px-1.5 py-px text-[12px] font-medium text-muted tabular-nums">{count}</span>
        )}
      </h1>
      {children && <p className="mt-1 text-[13px] text-muted">{children}</p>}
    </div>
  );
}
