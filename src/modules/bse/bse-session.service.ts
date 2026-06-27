import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { BseSoapClient } from "./bse-soap.client";

type Scope = "order" | "other";
const TTL_MS: Record<Scope, number> = { order: 55 * 60 * 1000, other: 4 * 60 * 1000 };

@Injectable()
export class BseSessionService {
  private cache: Partial<Record<Scope, { token: string; expiresAt: number }>> = {};
  private inflight: Partial<Record<Scope, Promise<string>>> = {};

  constructor(private readonly soap: BseSoapClient) {}

  async getToken(scope: Scope): Promise<string> {
    const cached = this.cache[scope];
    if (cached && Date.now() < cached.expiresAt) return cached.token;
    if (this.inflight[scope]) return this.inflight[scope]!;        // serialize concurrent refreshes
    this.inflight[scope] = this.refresh(scope).finally(() => { delete this.inflight[scope]; });
    return this.inflight[scope]!;
  }

  private async refresh(scope: Scope): Promise<string> {
    const passKey = this.makePassKey();
    const token = await this.soap.getPassword(passKey);
    this.cache[scope] = { token, expiresAt: Date.now() + TTL_MS[scope] };
    return token;
  }

  private makePassKey(): string {
    // alphanumeric only — BSE rejects special characters in PassKey
    return randomBytes(16).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  }
}
