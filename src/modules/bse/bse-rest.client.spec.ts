import { of } from "rxjs";
import { BseRestClient } from "./bse-rest.client";

function make(http: any) {
  const cfg = { restBaseUrl: "https://demo/StarMFCommonAPI", assertConfigured: () => {} } as any;
  return new BseRestClient(http, cfg);
}

describe("BseRestClient.registerUcc", () => {
  it("POSTs to the UCC endpoint and returns the client code on success", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { Status: "0", ClientCode: "C1" } })); // VERIFY shape
    const client = make({ post });
    const res = await client.registerUcc({ clientCode: "C1" } as any);
    expect(post).toHaveBeenCalledWith(expect.stringContaining("/ClientMaster/Registration"), expect.anything());
    expect(res.ucc).toBe("C1");
  });

  it("throws BseError when BSE reports a failure status", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { Status: "1", Remarks: "PAN invalid" } }));
    const client = make({ post });
    await expect(client.registerUcc({ clientCode: "C1" } as any)).rejects.toMatchObject({ bseCode: "1" });
  });
});
