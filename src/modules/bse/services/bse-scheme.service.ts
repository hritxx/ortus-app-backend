import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { BseSdkClient } from "../sdk/bse-sdk.client";

@Injectable()
export class BseSchemeService {
  private readonly logger = new Logger(BseSchemeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sdk: BseSdkClient,
  ) {}

  listFunds(search?: string, category?: string) {
    return this.prisma.mfScheme.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search ? { schemeName: { contains: search, mode: "insensitive" } } : {}),
      },
      take: 50,
      orderBy: { schemeName: "asc" },
    });
  }

  /**
   * Ingests the BSE scheme master into MfScheme so /bse/funds is fast/offline-resilient.
   * CONFIRM IN UAT: master_scheme_list response fields.
   */
  async ingestSchemeMaster(): Promise<{ upserted: number }> {
    const resp = await this.sdk.masterSchemeList({ data: {} });
    const rows: any[] = resp?.dataList ?? resp?.data ?? [];
    let upserted = 0;
    for (const r of rows) {
      const schemeCode = r.scheme_code ?? r.schemeCode ?? r.unique_no;
      if (!schemeCode) continue;
      await this.prisma.mfScheme.upsert({
        where: { schemeCode: String(schemeCode) },
        create: {
          schemeCode: String(schemeCode),
          schemeName: r.scheme_name ?? r.schemeName ?? "",
          amcName: r.amc_name ?? r.amc ?? null,
          category: r.category ?? null,
          isin: r.isin ?? null,
          sipAllowed: Boolean(r.sip_flag ?? r.sipAllowed ?? false),
        },
        update: {
          schemeName: r.scheme_name ?? r.schemeName ?? "",
          amcName: r.amc_name ?? r.amc ?? null,
          category: r.category ?? null,
        },
      });
      upserted++;
    }
    return { upserted };
  }
}
