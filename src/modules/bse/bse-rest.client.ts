import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { BseConfig } from "./bse.config";
import { REST } from "./bse.fields";
import { mapBseError } from "./bse-error.map";
import { UccPayload, FatcaPayload } from "./bse.types";

@Injectable()
export class BseRestClient {
  private readonly logger = new Logger(BseRestClient.name);

  constructor(private readonly http: HttpService, private readonly cfg: BseConfig) {}

  async registerUcc(payload: UccPayload): Promise<{ ucc: string }> {
    this.cfg.assertConfigured();
    const url = this.cfg.restBaseUrl + REST.uccRegistration;
    const { data } = await firstValueFrom(this.http.post(url, this.toBseUcc(payload)));
    if (data?.Status !== "0") mapBseError(data?.Status ?? "unknown", data?.Remarks); // VERIFY success status
    return { ucc: data.ClientCode };
  }

  async registerFatca(payload: FatcaPayload): Promise<void> {
    this.cfg.assertConfigured();
    const url = this.cfg.restBaseUrl + REST.fatcaRegistration;
    const { data } = await firstValueFrom(this.http.post(url, payload));
    if (data?.Status !== "0") mapBseError(data?.Status ?? "unknown", data?.Remarks);
  }

  // Maps internal camelCase to BSE's expected keys. VERIFY every key vs PDF.
  private toBseUcc(p: UccPayload) {
    return {
      ClientCode: p.clientCode,
      FirstName: p.firstName,
      PAN: p.pan,
      HoldingNature: p.holdingMode,
      TaxStatus: p.taxStatus,
      AccNo: p.bankAccount,
      IFSCCode: p.ifsc,
      AccType: p.accountType,
      Email: p.email,
      Mobile: p.mobile,
      ClientType: p.allotmentMode,
    };
  }
}
