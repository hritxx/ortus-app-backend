import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
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
  private clientPromise?: Promise<soap.Client>;

  constructor(private readonly cfg: BseConfig) {}

  private async getClient(): Promise<soap.Client> {
    // Cache the PROMISE (not the resolved client) so concurrent callers share a
    // single in-flight createClientAsync and never double-init / leak a client.
    // On rejection (e.g. WSDL unreachable at startup) reset the cache so the next
    // call retries instead of permanently returning the same rejected promise.
    if (!this.clientPromise) {
      this.cfg.assertConfigured();
      this.clientPromise = soap.createClientAsync(this.cfg.soapOrderUrl + "?wsdl") // VERIFY URL/WSDL
        .catch((err) => {
          this.clientPromise = undefined;
          throw err;
        });
    }
    return this.clientPromise;
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
      BuySellType: input.orderType, // VERIFY: BSE PDF (maps LUMPSUM/SIP -> BSE order type field)
    });
    const raw = result?.orderEntryParamResult ?? "";  // VERIFY result field
    const { code, message, payload } = parsePipeResponse(raw);
    if (code !== "100") mapBseError(code, message);
    if (!payload) throw new InternalServerErrorException("BSE returned success but no order number");
    return { orderNumber: payload };
  }
}
