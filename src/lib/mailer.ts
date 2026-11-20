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

/** Gabarit commun : salutation, message, bouton, durée de validité du lien (facultative), note finale. */
function layout(o: { name: string; intro: string; button: string; url: string; validity?: string; ignore: string; subject: string }) {
  const first = o.name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Bonjour ${first},` : "Bonjour,";
  const text =
    `${hello}\n\n${o.intro} Ouvre ce lien${o.validity ? ` (valable ${o.validity})` : ""} :\n${o.url}\n\n${o.ignore}\n\nL'équipe Luka`;
  const url = escapeHtml(o.url);
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#14112b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:22px;font-weight:bold;letter-spacing:-0.5px">luka</td></tr>
        <tr><td style="padding-top:24px;font-size:15px;line-height:1.6">
          <p style="margin:0 0 12px">${escapeHtml(hello)}</p>
          <p style="margin:0 0 24px">${escapeHtml(o.intro)}</p>
          <a href="${url}" style="display:inline-block;background:#5b3df5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${escapeHtml(o.button)}</a>
          <p style="margin:24px 0 0;font-size:13px;color:#8b889b">${o.validity ? `Le lien est valable ${escapeHtml(o.validity)}. ` : ""}Si le bouton ne marche pas, copie ce lien dans ton navigateur :<br>
            <a href="${url}" style="color:#5b3df5;word-break:break-all">${url}</a></p>
          <p style="margin:16px 0 0;font-size:13px;color:#8b889b">${escapeHtml(o.ignore)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: o.subject, html, text };
}

/** E-mail d'activation du compte (inscription avec e-mail et mot de passe). */
export function verificationMail(name: string, url: string) {
  return layout({
    name,
    url,
    subject: "Active ton compte Luka",
    intro: "Bienvenue sur Luka ! Clique sur le bouton ci-dessous pour activer ton compte.",
    button: "Activer mon compte",
    validity: "24 heures",
    ignore: "Si tu n'as pas créé de compte sur Luka, ignore simplement cet e-mail.",
  });
}

/** E-mail de réinitialisation du mot de passe. */
export function resetPasswordMail(name: string, url: string) {
  return layout({
    name,
    url,
    subject: "Réinitialise ton mot de passe Luka",
    intro: "Tu as demandé à changer ton mot de passe Luka. Clique sur le bouton ci-dessous pour en choisir un nouveau.",
    button: "Choisir un nouveau mot de passe",
    validity: "1 heure",
    ignore: "Si tu n'as rien demandé, ignore cet e-mail : ton mot de passe actuel reste valable.",
  });
}

/** E-mail de fin de collecte (réussie ou en échec). */
export function collecteMail(name: string, url: string, c: { title: string; rows?: number; error?: string }) {
  const done = c.error === undefined;
  return layout({
    name,
    url,
    subject: done ? `Ta collecte est prête : ${c.title}` : `Échec de ta collecte : ${c.title}`,
    intro: done
      ? `Ta collecte « ${c.title} » est terminée : ${c.rows ?? 0} ligne(s) trouvée(s), à vérifier avant de les exporter.`
      : `Ta collecte « ${c.title} » n'a pas pu aboutir (${c.error}). Tu peux en lancer une nouvelle depuis Luka.`,
    button: done ? "Voir les résultats" : "Ouvrir la collecte",
    ignore: "Tu reçois cet e-mail parce que ta collecte a duré plus de quelques minutes.",
  });
}

/** E-mail de mise à jour automatique : envoyé seulement quand quelque chose a changé. */
export function refreshMail(name: string, url: string, c: { title: string; summary: string }) {
  return layout({
    name,
    url,
    subject: `Du nouveau dans ta collecte : ${c.title}`,
    intro: `Luka a mis à jour ta collecte « ${c.title} » : ${c.summary}. Les lignes concernées sont marquées pour que tu les vérifies.`,
    button: "Voir les changements",
    ignore: "Tu reçois cet e-mail parce que la mise à jour automatique est activée sur cette collecte. Tu peux la désactiver depuis la collecte.",
  });
}

/** E-mail de confirmation de la suppression du compte. */
export function deleteAccountMail(name: string, url: string) {
  return layout({
    name,
    url,
    subject: "Confirme la suppression de ton compte Luka",
    intro:
      "Tu as demandé à supprimer ton compte Luka. Clique sur le bouton ci-dessous pour confirmer : ton compte, tes collectes et leurs lignes seront supprimés définitivement.",
    button: "Supprimer définitivement mon compte",
    validity: "1 heure",
    ignore: "Si tu n'as rien demandé, ignore cet e-mail : ton compte reste intact. Pense alors à changer ton mot de passe.",
  });
}
