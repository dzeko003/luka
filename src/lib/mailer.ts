import nodemailer from "nodemailer";

/**
 * Envoi d'e-mails par SMTP (Brevo, Resend, Mailjet, OVH… : tous proposent un accès SMTP).
 * Sans SMTP_HOST, en développement, le contenu est affiché dans la console du serveur.
 */
const smtp = {
  host: process.env.SMTP_HOST ?? "",
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASSWORD ?? "",
  from: process.env.MAIL_FROM ?? "Luka <no-reply@luka.berenismassamba.com>",
};

export const mailEnabled = Boolean(smtp.host);
const isDev = process.env.NODE_ENV !== "production";

let transporter: nodemailer.Transporter | undefined;
function transport() {
  transporter ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // 465 : TLS direct ; 587 : STARTTLS
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return transporter;
}

export async function sendMail(mail: { to: string; subject: string; html: string; text: string }) {
  if (!mailEnabled) {
    if (isDev) console.info(`[mail] (non envoyé, SMTP_HOST absent) À : ${mail.to}\nObjet : ${mail.subject}\n${mail.text}`);
    else console.warn(`[mail] SMTP_HOST absent : e-mail « ${mail.subject} » non envoyé`);
    return;
  }
  await transport().sendMail({ from: smtp.from, ...mail });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** E-mail d'activation du compte (inscription avec e-mail et mot de passe). */
export function verificationMail(name: string, url: string) {
  const first = name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Bonjour ${first},` : "Bonjour,";
  const text =
    `${hello}\n\nBienvenue sur Luka ! Pour activer ton compte, ouvre ce lien (valable 24 heures) :\n${url}\n\n` +
    "Si tu n'as pas créé de compte sur Luka, ignore simplement cet e-mail.\n\nL'équipe Luka";
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#14112b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:22px;font-weight:bold;letter-spacing:-0.5px">luka</td></tr>
        <tr><td style="padding-top:24px;font-size:15px;line-height:1.6">
          <p style="margin:0 0 12px">${escapeHtml(hello)}</p>
          <p style="margin:0 0 24px">Bienvenue sur Luka ! Clique sur le bouton ci-dessous pour activer ton compte.</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#5b3df5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Activer mon compte</a>
          <p style="margin:24px 0 0;font-size:13px;color:#8b889b">Le lien est valable 24 heures. Si le bouton ne marche pas, copie ce lien dans ton navigateur :<br>
            <a href="${escapeHtml(url)}" style="color:#5b3df5;word-break:break-all">${escapeHtml(url)}</a></p>
          <p style="margin:16px 0 0;font-size:13px;color:#8b889b">Si tu n'as pas créé de compte sur Luka, ignore simplement cet e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: "Active ton compte Luka", html, text };
}
