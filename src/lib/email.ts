// Thin wrapper around Resend's REST API (no SDK dependency, just fetch --
// keeps the build simple and avoids adding a package for one API call).
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // onboarding@resend.dev works without verifying a custom domain, but
      // only for sending to the account owner's own address -- which is
      // exactly what this app does.
      from: "Congress Trades <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }

  return res.json();
}
