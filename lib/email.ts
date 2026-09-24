import { env } from "cloudflare:workers";
import { ApiError } from "./api-error";
import { deliverAccountEmail, validEmailConfiguration, type MailConfiguration } from "./email-transport";

export function emailConfigured(): boolean {
  return validEmailConfiguration(env as MailConfiguration);
}
export async function sendAccountEmail(email: string, token: string, purpose: "verify" | "reset") {
  if (!emailConfigured()) throw new ApiError(503, "email_unavailable", "Email delivery is not configured yet. Contact the platform administrator.");
  if (!await deliverAccountEmail(env as MailConfiguration, email, token, purpose)) throw new ApiError(503, "email_unavailable", "Email could not be delivered. Please try again later.");
}
