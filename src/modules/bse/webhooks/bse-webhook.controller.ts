import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { BseWebhookService } from "./bse-webhook.service";

/**
 * BSE StAR MF v2 webhook receiver. NO JwtAuthGuard — BSE calls this server-to-server.
 * SECURITY: restrict to BSE public IP ranges at the edge (nginx/ALB/security-group)
 * before go-live; BSE recommends IP whitelisting. We always reply JSON 200 to prevent
 * retry flooding (per BSE guidance).
 */
@Controller("bse/webhooks")
export class BseWebhookController {
  constructor(private readonly webhooks: BseWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() body: any) {
    return this.webhooks.handle(body);
  }
}
