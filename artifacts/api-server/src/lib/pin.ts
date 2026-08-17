import { createHash } from "node:crypto";

/** One-way hash for a player's recovery PIN — never store or return the raw PIN. */
export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}
