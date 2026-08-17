import type { NextFunction, Request, Response } from "express";

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "admin123";

/** True when the request carries a valid `Authorization: Bearer <admin password>` header. */
export function isAdminRequest(req: Request): boolean {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  return token === ADMIN_PASSWORD;
}

/** Guards admin-only mutations. Expects `Authorization: Bearer <admin password>`. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: "Требуется авторизация администратора" });
    return;
  }

  next();
}
