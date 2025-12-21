import { z } from "zod";

/**
 * OAuth credentials validation schema
 */
export const OAuthCredentials = z.object({
  type: z.literal("oauth"),
  refresh: z.string(),
  access: z.string(),
  expires: z.number(),
});

export type OAuthCredentials = z.infer<typeof OAuthCredentials>;

/**
 * Validate OAuth credentials
 */
export function validateCredentials(data: unknown): OAuthCredentials {
  return OAuthCredentials.parse(data);
}

/**
 * Check if credentials are valid (type guard)
 */
export function isValidCredentials(data: unknown): data is OAuthCredentials {
  return OAuthCredentials.safeParse(data).success;
}