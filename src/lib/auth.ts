import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/config";

const COOKIE = "admin_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function getSessionCookieName() {
  return COOKIE;
}

export async function signAdminSession(payload: { sub: string; email: string }): Promise<string> {
  const secret = new TextEncoder().encode(getAuthSecret());
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
}

export async function verifyAdminSession(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(getAuthSecret());
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    return { sub, email };
  } catch {
    return null;
  }
}

export { MAX_AGE_SEC };
