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
   * VERIFIED against UAT (2026-07-19): request requires start/length/fields; schemes come
   * back under `data.lists`; the order-able code is `scheme_bse_code`. Paginates in batches.
   */
  async ingestSchemeMaster(batchSize = 500): Promise<{ upserted: number }> {
    let start = 0;
    let upserted = 0;

    for (;;) {
      const resp = await this.sdk.masterSchemeList({
        data: { start, length: batchSize, fields: ["ALL"], count_only: false, filter_param: {}, search: {} },
      });
      const rows: any[] = resp?.data?.lists ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        const schemeCode = r.scheme_bse_code ?? r.scheme_cpc_code;
        if (!schemeCode) continue;
        const sipAllowed = Array.isArray(r.systematic)
          ? r.systematic.some((s: any) => s?.sip_flag)
          : false;
        const minPurchase = this.extractMinAmount(r);
        await this.prisma.mfScheme.upsert({
          where: { schemeCode: String(schemeCode) },
          create: {
            schemeCode: String(schemeCode),
            schemeName: r.name ?? "",
            amcName: r.scheme_amc_name ?? null,
            category: r.scheme_category ?? r.scheme_sub_category ?? null,
            isin: r.scheme_isin ?? null,
            sipAllowed,
            minPurchase,
          },
          update: {
            schemeName: r.name ?? "",
            amcName: r.scheme_amc_name ?? null,
            category: r.scheme_category ?? r.scheme_sub_category ?? null,
            isin: r.scheme_isin ?? null,
            sipAllowed,
            minPurchase,
          },
        });
        upserted++;
      }

      if (rows.length < batchSize) break;
      start += batchSize;
    }
    return { upserted };
  }

  // Pulls the purchase minimum from the lumpsum "Purchase" transaction block, when present.
  private extractMinAmount(r: any): number | null {
    const lumpsum: any[] = Array.isArray(r?.lumpsum) ? r.lumpsum : [];
    const purchase = lumpsum.find((l) => /purchase/i.test(l?.scheme_transaction_type ?? ""));
    const min = purchase?.scheme_transaction_single_details?.scheme_transaction_amt?.scheme_transaction_min_amt;
    return typeof min === "number" ? min : null;
  }
}
