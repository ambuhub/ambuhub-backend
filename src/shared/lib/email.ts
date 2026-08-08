import { Resend } from "resend";
import { logger } from "./logger";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (from) {
    return from;
  }
  return "Ambuhub <onboarding@resend.dev>";
}

function formatResendError(error: unknown): string {
  if (!error) {
    return "Failed to send email";
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.name === "string" && record.name.trim()) {
      return record.name.trim();
    }
  }
  return "Failed to send email";
}

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  purpose: "verify_email" | "reset_password" | "change_email";
}): Promise<void> {
  const subject =
    input.purpose === "verify_email"
      ? "Your Ambuhub verification code"
      : input.purpose === "change_email"
        ? "Confirm your new Ambuhub email"
        : "Your Ambuhub password reset code";

  const intro =
    input.purpose === "verify_email"
      ? "Use this code to verify your Ambuhub email address."
      : input.purpose === "change_email"
        ? "Use this code to confirm your new Ambuhub email address."
        : "Use this code to reset your Ambuhub password.";

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Ambuhub</h1>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">${intro}</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 24px 0; color: #1e3a8a;">${input.code}</p>
      <p style="font-size: 14px; color: #64748b;">This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
    </div>
  `;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: getFromAddress(),
      to: input.to,
      subject,
      html,
    });

    if (error) {
      const message = formatResendError(error);
      logger.error("Resend email failed", { error, to: input.to, message });
      throw new Error(message);
    }

    logger.info("OTP email sent", {
      to: input.to,
      purpose: input.purpose,
      id: data?.id ?? null,
    });
  } catch (err) {
    if (err instanceof Error && err.message && err.message !== "Failed to send email") {
      throw err;
    }
    const message = formatResendError(err);
    logger.error("Resend email threw", { error: err, to: input.to, message });
    throw new Error(message);
  }
}
