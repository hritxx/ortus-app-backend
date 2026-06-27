import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>("FIREBASE_PROJECT_ID");
    const privateKey = this.configService.get<string>("FIREBASE_PRIVATE_KEY");
    const clientEmail = this.configService.get<string>("FIREBASE_CLIENT_EMAIL");

    if (!projectId || !privateKey || !clientEmail || projectId === "your-firebase-project-id") {
      this.logger.warn("⚠️ Firebase credentials are not configured or are placeholder values. FCM push notifications will run in mock mode.");
      return;
    }

    try {
      // Clean private key formatting from env
      const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: formattedPrivateKey,
          clientEmail,
        }),
      });

      this.logger.log("✅ Firebase Admin SDK initialized successfully");
    } catch (error) {
      this.logger.error("❌ Failed to initialize Firebase Admin SDK:", error);
    }
  }

  async sendPushNotification(
    deviceTokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<boolean> {
    if (deviceTokens.length === 0) {
      return false;
    }

    this.logger.log(`📱 Sending push notification: "${title}" to ${deviceTokens.length} devices...`);

    if (!this.firebaseApp) {
      this.logger.log(`[Mock FCM] Sent push to tokens: ${JSON.stringify(deviceTokens)}: "${title}" - "${body}"`);
      return true;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: deviceTokens,
        notification: {
          title,
          body,
        },
        data,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      this.logger.log(`✅ FCM multicast sent. Success count: ${response.successCount}, Failure count: ${response.failureCount}`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(`FCM error for token ${deviceTokens[idx]}:`, resp.error);
          }
        });
      }

      return true;
    } catch (error) {
      this.logger.error("❌ Error sending FCM push notification:", error);
      return false;
    }
  }
}
