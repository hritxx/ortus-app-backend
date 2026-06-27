import { Module, Global } from "@nestjs/common";
import { EmailService } from "./email.service";
import { FirebaseService } from "./firebase.service";

@Global()
@Module({
  providers: [EmailService, FirebaseService],
  exports: [EmailService, FirebaseService],
})
export class EmailModule {}
