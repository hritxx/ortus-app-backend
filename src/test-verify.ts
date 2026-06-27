import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CoursesService } from "./modules/courses/courses.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const coursesService = app.get(CoursesService);

  const userId = "cmm3kb3040000zpukz1h2iy6v";
  const courseId = "cmlm9gygo0002fis9pa02uwte";
  const enrollmentId = "cmq3vguxp0001vkwbo5i3o0o5"; // from successful run above
  const orderId = "order_SylytVeSVe8Iwd"; // from successful run above

  console.log("Verifying payment...");
  try {
    const res = await coursesService.verifyPayment(userId, courseId, {
      razorpayOrderId: orderId,
      razorpayPaymentId: `pay_${Date.now()}`,
      razorpaySignature: `mock_sig_${Date.now()}`,
      enrollmentId,
    });
    console.log("SUCCESS:", res);
  } catch (err: any) {
    console.error("ERROR TYPE:", err.constructor.name);
    console.error("ERROR MESSAGE:", err.message);
    if (err.response) {
      console.error("ERROR RESPONSE:", JSON.stringify(err.response, null, 2));
    }
    if (err.stack) {
      console.error("STACK TRACE:", err.stack);
    }
  }
  await app.close();
}

main();
