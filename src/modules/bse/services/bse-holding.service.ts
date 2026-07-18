import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";

/**
 * Holdings are DERIVED from our own allotments/redemptions (design decision D5).
 * Phase 3 may replace this with BSE holding/valuation reports as source of truth.
 */
@Injectable()
export class BseHoldingService {
  constructor(private readonly prisma: PrismaService) {}

  listHoldings(userId: string) {
    return this.prisma.mfHolding.findMany({ where: { userId }, orderBy: { schemeName: "asc" } });
  }

  getHolding(userId: string, schemeCode: string, folioNumber: string) {
    return this.prisma.mfHolding.findFirst({
      where: { userId, schemeCode, folioNumber },
    });
  }

  async upsertFromAllotment(input: {
    userId: string;
    ucc: string;
    schemeCode: string;
    schemeName: string;
    folioNumber: string;
    units: number;
    nav?: number;
  }): Promise<void> {
    const existing = await this.prisma.mfHolding.findUnique({
      where: {
        ucc_schemeCode_folioNumber: {
          ucc: input.ucc,
          schemeCode: input.schemeCode,
          folioNumber: input.folioNumber,
        },
      },
    });
    const units = (existing?.units ?? 0) + input.units;
    await this.prisma.mfHolding.upsert({
      where: {
        ucc_schemeCode_folioNumber: {
          ucc: input.ucc,
          schemeCode: input.schemeCode,
          folioNumber: input.folioNumber,
        },
      },
      create: {
        userId: input.userId,
        ucc: input.ucc,
        schemeCode: input.schemeCode,
        schemeName: input.schemeName,
        folioNumber: input.folioNumber,
        units: input.units,
        lastNav: input.nav,
      },
      update: { units, lastNav: input.nav ?? existing?.lastNav },
    });
  }

  async decrementOnRedeem(input: {
    ucc: string;
    schemeCode: string;
    folioNumber: string;
    units?: number;
    allUnits?: boolean;
  }): Promise<void> {
    const existing = await this.prisma.mfHolding.findUnique({
      where: {
        ucc_schemeCode_folioNumber: {
          ucc: input.ucc,
          schemeCode: input.schemeCode,
          folioNumber: input.folioNumber,
        },
      },
    });
    if (!existing) return;

    const remaining = input.allUnits ? 0 : Math.max(0, existing.units - (input.units ?? 0));
    if (remaining <= 0) {
      await this.prisma.mfHolding.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.mfHolding.update({ where: { id: existing.id }, data: { units: remaining } });
    }
  }
}
