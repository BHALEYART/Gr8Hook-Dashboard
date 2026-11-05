// Transactional email through Resend (https://resend.com). Needs RESEND_API_KEY and a verified sending domain.
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(msg: { to: string | string[]; subject: string; html: string; text: string; replyTo?: string; from?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: msg.from ?? process.env.AUDIT_FROM_EMAIL ?? "Gr8 Hook <reports@gr8hook.com>",
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo ?? process.env.AUDIT_REPLY_TO ?? "Sales@Gr8Hook.com",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id: string };
}
