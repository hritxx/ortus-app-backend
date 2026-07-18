import { buildOrderNewPayload } from "./order.mapper";

const base = {
  ucc: "ORTUS0001",
  member: "66881",
  scheme: "ABC1234-GR",
  memOrdRefId: "REF-1",
  email: "a@b.com",
  mobile: "9999999999",
};

describe("buildOrderNewPayload", () => {
  it("builds a buy (purchase) order", () => {
    const o = buildOrderNewPayload({ ...base, side: "BUY", amount: 5000 }).data.orders[0];
    expect(o.type).toBe("p");
    expect(o.amount).toBe(5000);
    expect(o.is_units).toBe(false);
    expect(o.all_units).toBe(false);
    expect(o.is_fresh).toBe(true);
    expect(o.src).toBe("lumpsum");
    expect(o.mem_ord_ref_id).toBe("REF-1");
  });

  it("builds a sell by units", () => {
    const o = buildOrderNewPayload({
      ...base,
      side: "SELL",
      units: 10.5,
      folio: "FOLIO1",
    }).data.orders[0];
    expect(o.type).toBe("r");
    expect(o.is_units).toBe(true);
    expect(o.units).toBe(10.5);
    expect(o.all_units).toBe(false);
    expect(o.folio).toBe("FOLIO1");
    expect(o.src).toBe("redemption");
  });

  it("builds a sell-all", () => {
    const o = buildOrderNewPayload({
      ...base,
      side: "SELL",
      allUnits: true,
      folio: "FOLIO1",
    }).data.orders[0];
    expect(o.type).toBe("r");
    expect(o.all_units).toBe(true);
    expect(o.is_units).toBe(false);
  });
});
