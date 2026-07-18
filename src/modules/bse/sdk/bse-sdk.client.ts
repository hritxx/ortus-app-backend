import { Injectable, Logger } from "@nestjs/common";
import { BseConfig } from "../bse.config";
import { normalizeBseResponse, mapBseError } from "../mapping/bse-error.map";

// The official SDK is untyped CommonJS; load it dynamically and treat services as `any`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StarMF = require("bse-starmfv2-sdk");

type CachedToken = { token: string; expiresAt: number };

/**
 * The single gateway to the BSE StAR MF v2 SDK. Owns:
 *  - login + short-lived access-token caching (serialized refresh),
 *  - error normalization (the SDK returns raw bodies and never throws).
 *
 * Domain services call the typed passthroughs here; they never touch the SDK directly.
 */
@Injectable()
export class BseSdkClient {
  private readonly logger = new Logger(BseSdkClient.name);

  private readonly login: any;
  private readonly ucc: any;
  private readonly trxn: any;
  private readonly masterData: any;
  private readonly nav: any;

  private cache?: CachedToken;
  private inflight?: Promise<string>;

  constructor(private readonly cfg: BseConfig) {
    const opts = { baseUrl: cfg.baseUrl };
    this.login = new StarMF.BseLoginService(opts);
    this.ucc = new StarMF.UccService(opts);
    this.trxn = new StarMF.TrxnService(opts);
    this.masterData = new StarMF.MasterDataService(opts);
    this.nav = new StarMF.NavService(opts);
  }

  /** Returns a valid access token, logging in (once) when the cache is cold/expired. */
  async getToken(): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) return this.cache.token;
    if (this.inflight) return this.inflight;
    this.inflight = this.refreshToken().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async refreshToken(): Promise<string> {
    this.cfg.assertConfigured();
    const resp = await this.login.login(this.cfg.username, this.cfg.password);
    const token = resp?.data?.access_token;
    if (!token) {
      mapBseError(
        String(resp?.status ?? resp?.code ?? "LOGIN_FAILED"),
        resp?.errorMsg ?? resp?.error ?? "BSE login failed",
      );
    }
    this.cache = { token, expiresAt: Date.now() + this.cfg.tokenTtlMs };
    return token;
  }

  /** Forces a re-login on the next getToken() (e.g. after a 401 from a downstream call). */
  invalidateToken(): void {
    this.cache = undefined;
  }

  // ---- UCC ----
  async addUccPhysical(payload: unknown): Promise<any> {
    return this.call((t) => this.ucc.createPhysicalUcc(t, payload));
  }
  async updateUcc(payload: unknown): Promise<any> {
    return this.call((t) => this.ucc.updateUcc(t, payload));
  }
  async getUcc(payload: unknown): Promise<any> {
    return this.call((t) => this.ucc.getParticularUcc(t, payload));
  }

  // ---- Orders (order_new covers buy type:"p" and sell type:"r") ----
  async orderNew(payload: unknown): Promise<any> {
    return this.call((t) => this.trxn.purchaseNewOrder(t, payload));
  }
  async orderGet(payload: unknown): Promise<any> {
    return this.call((t) => this.trxn.getOrder(t, payload));
  }
  async orderList(payload: unknown): Promise<any> {
    return this.call((t) => this.trxn.getAllOrders(t, payload));
  }
  async orderCancel(payload: unknown): Promise<any> {
    return this.call((t) => this.trxn.cancelPurchaseOrder(t, payload));
  }

  // ---- Master / NAV ----
  async masterSchemeList(payload: unknown): Promise<any> {
    return this.call((t) => this.masterData.getSchemeMasterList(t, payload));
  }
  async navMasterList(payload: unknown): Promise<any> {
    return this.call((t) => this.nav.getNavMasterList(t, payload));
  }

  /** Runs an SDK call with a fresh token and normalizes the response into success or a BseError. */
  private async call<T = any>(fn: (token: string) => Promise<any>): Promise<T> {
    const token = await this.getToken();
    const resp = await fn(token);
    return normalizeBseResponse<T>(resp);
  }
}
