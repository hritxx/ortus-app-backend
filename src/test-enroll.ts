import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CoursesService } from "./modules/courses/courses.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const coursesService = app.get(CoursesService);

  const courseId = "cmpt2l2050000in3ac2x2d8x5"; // BFSI course ID
  const userId = "cmm3kb3040000zpukz1h2iy6v";

  console.log(`Enrolling user ${userId} in course ${courseId}...`);
  try {
    const res = await coursesService.enrollInCourse(userId, courseId);
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
