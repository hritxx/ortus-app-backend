import { Injectable, Logger } from "@nestjs/common";
import * as soap from "soap";
import { BseConfig } from "./bse.config";
import { SOAP } from "./bse.fields";
import { mapBseError } from "./bse-error.map";

export interface SoapOrderInput {
  token: string; ucc: string; schemeCode: string; amount: number;
  buySell: "P"; orderType: "LUMPSUM" | "SIP";
}

// Exported pure function so it is unit-testable without a SOAP server.
export function parsePipeResponse(raw: string): { code: string; message: string; payload?: string } {
  const [code, message, payload] = (raw ?? "").split(SOAP.responseDelimiter);
  return { code, message, payload };
}

@Injectable()
export class BseSoapClient {
  private readonly logger = new Logger(BseSoapClient.name);
  private client?: soap.Client;

  constructor(private readonly cfg: BseConfig) {}

  private async getClient(): Promise<soap.Client> {
    if (!this.client) {
      this.cfg.assertConfigured();
      this.client = await soap.createClientAsync(this.cfg.soapOrderUrl + "?wsdl"); // VERIFY URL/WSDL
    }
    return this.client;
  }

  async getPassword(passKey: string): Promise<string> {
    const client = await this.getClient();
    // VERIFY arg shape vs PDF: UserId/MemberId/Password/PassKey
    const [result] = await client.getPasswordAsync({
      UserId: this.cfg.userId, MemberId: this.cfg.memberCode, Password: this.cfg.password, PassKey: passKey,
    });
    const raw = result?.getPasswordResult ?? ""; // VERIFY result field
    const { code, message, payload } = parsePipeResponse(raw);
    if (code !== "100") mapBseError(code, message);   // VERIFY success code
    return payload ?? message;                        // session token
  }

  async placeOrder(input: SoapOrderInput): Promise<{ orderNumber: string }> {
    const client = await this.getClient();
    // VERIFY full param set vs PDF (TransCode, OrderId, BuySell, BuySellType, DPTxn, etc.)
    // Cast to any: soap.Client type does not allow arbitrary string indexing in TS
    const methodName = SOAP.orderEntryMethod + "Async";
    const [result] = await (client as any)[methodName]({
      EncryptedPassword: input.token, ClientCode: input.ucc, SchemeCd: input.schemeCode,
      Amount: input.amount, BuySell: input.buySell, MemberId: this.cfg.memberCode,
    });
    const raw = result?.orderEntryParamResult ?? "";  // VERIFY result field
    const { code, message, payload } = parsePipeResponse(raw);
    if (code !== "100") mapBseError(code, message);
    return { orderNumber: payload };
  }
}
