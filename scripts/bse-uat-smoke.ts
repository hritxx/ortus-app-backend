/**
 * BSE StAR MF v2 UAT smoke test — NOT a jest test (it hits the live demo API).
 *
 * Purpose: exercise the real UAT flow end-to-end and RECORD every request/response into
 * src/modules/bse/__fixtures__/*.json so we can pin the real v2 envelope and replace all the
 * `// CONFIRM IN UAT` guesses in mappers/status/error maps.
 *
 * Prereqs: set BSE_BASE_URL, BSE_USERNAME, BSE_PASSWORD, BSE_MEMBER_CODE in .env, then:
 *   npx ts-node scripts/bse-uat-smoke.ts
 *
 * The buy flow pauses after get_exchpg_service — open the printed redirect URL, pay on the
 * demo PG, then press Enter to continue polling order status.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StarMF = require("bse-starmfv2-sdk");
import { buildAddUccPayload } from "../src/modules/bse/mapping/ucc.mapper";
import { buildOrderNewPayload, buildOrderGetPayload } from "../src/modules/bse/mapping/order.mapper";

const FIXTURES = path.join(__dirname, "..", "src", "modules", "bse", "__fixtures__");

function record(name: string, payload: unknown) {
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(path.join(FIXTURES, `${name}.json`), JSON.stringify(payload, null, 2));
  console.log(`\n=== ${name} ===\n`, JSON.stringify(payload, null, 2));
}

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => (rl.close(), res(a))));
}

async function main() {
  const baseUrl = process.env.BSE_BASE_URL ?? "https://starmfv2demo.bseindia.com";
  const member = process.env.BSE_MEMBER_CODE ?? "";
  const opts = { baseUrl };

  const login = new StarMF.BseLoginService(opts);
  const ucc = new StarMF.UccService(opts);
  const trxn = new StarMF.TrxnService(opts);
  const master = new StarMF.MasterDataService(opts);

  // 1. Login
  const loginResp = await login.login(process.env.BSE_USERNAME, process.env.BSE_PASSWORD);
  record("login.response", loginResp);
  const token = loginResp?.data?.access_token;
  if (!token) throw new Error("No access token — check credentials");

  // 2. Scheme master (requires start/length/fields; schemes come back under data.lists)
  const masterResp = await master.getSchemeMasterList(token, {
    data: { start: 0, length: 5, fields: ["ALL"], count_only: false, filter_param: {}, search: {} },
  });
  record("master_scheme_list.response", masterResp);
  const firstScheme = masterResp?.data?.lists?.[0];
  const schemeCode = process.env.SMOKE_SCHEME ?? firstScheme?.scheme_bse_code ?? "";
  console.log("Using scheme:", schemeCode, firstScheme?.name);

  // 3. add_ucc (PAN 4th char must be "P" for an individual)
  const clientCode = "ORTUSSMOKE" + Date.now().toString().slice(-6);
  const uccPayload = buildAddUccPayload(
    {
      name: "Smoke Test",
      panNumber: "ABCPE1234F",
      email: "smoke@example.com",
      phone: "9999999999",
      dateOfBirth: "1985-06-15",
      address: "Flat 12, Main St",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
      bankAccount: "123456789012",
      ifscCode: "HDFC0000001",
    },
    clientCode,
    member,
  );
  record("add_ucc.request", uccPayload);
  record("add_ucc.response", await ucc.createPhysicalUcc(token, uccPayload));

  // 4. Buy
  const buyRef = "SMOKE-BUY-" + Date.now();
  const buyPayload = buildOrderNewPayload({
    side: "BUY",
    ucc: clientCode,
    member,
    scheme: schemeCode,
    amount: 5000,
    memOrdRefId: buyRef,
    email: "smoke@example.com",
    mobile: "9999999999",
  });
  record("order_new_buy.request", buyPayload);
  const buyResp = await trxn.purchaseNewOrder(token, buyPayload);
  record("order_new_buy.response", buyResp);

  console.log("\nInspect order_new_buy.response for the BSE order id, then continue.");
  await prompt("Press Enter after paying on the demo PG (open the redirect URL manually)...");

  const buyOrderId = buyResp?.data?.orders?.[0]?.id;
  if (buyOrderId) {
    record("order_get_buy.response", await trxn.getOrder(token, buildOrderGetPayload(String(buyOrderId))));
  }

  console.log("\nSmoke run complete. Fixtures written to", FIXTURES);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
