import { HttpException, HttpStatus } from "@nestjs/common";

export class BseError extends HttpException {
  constructor(public readonly bseCode: string, public readonly userMessage: string, rawMessage?: string) {
    super({ bseCode, message: userMessage, raw: rawMessage }, HttpStatus.BAD_GATEWAY);
  }
}

// VERIFY: BSE PDF — numeric codes are illustrative. Keep this table as the single source.
const CODE_TO_MESSAGE: Record<string, string> = {
  "100": "We couldn't authenticate with the exchange. Please try again.",
  "101": "Your KYC is not yet complete with the exchange.",
  // ... extend from the BSE error-code appendix ...
};

export function mapBseError(rawCode: string, rawMessage?: string): never {
  const userMessage = CODE_TO_MESSAGE[rawCode] ?? "Something went wrong placing your order. Please try again.";
  throw new BseError(rawCode, userMessage, rawMessage);
}
