import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
const jwksUrl = new URL(
  process.env.AUTH_JWKS_URL || 'http://localhost:3000/api/auth/jwks',
);
const JWKS = createRemoteJWKSet(jwksUrl);
export type AuthUser = { id: string; email: string; name?: string };
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Authentication required' });
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS);
    const email = String(payload.email || '');
    const id = String(payload.sub || payload.id || '');
    if (!email || !id)
      return res.status(401).json({ message: 'Invalid token payload' });
    req.user = {
      id,
      email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
