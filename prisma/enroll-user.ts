import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USER_ID = "cmlm8a79p0000y982n7dt54og"; // Hriteek Roy

async function main() {
  console.log("🎓 Enrolling user in courses and services...\n");

  // Get all courses
  const courses = await prisma.course.findMany({
    include: { channel: true },
  });

  if (courses.length === 0) {
    console.log("❌ No courses found. Please run seed-courses.ts first:");
    console.log("   npx ts-node prisma/seed-courses.ts");
    process.exit(1);
  }

  console.log(`Found ${courses.length} courses\n`);

  // Enroll user in first 2 courses
  const coursesToEnroll = courses.slice(0, 2);

  for (const course of coursesToEnroll) {
    try {
      const enrollment = await prisma.courseEnrollment.upsert({
        where: {
          userId_courseId: {
            userId: USER_ID,
            courseId: course.id,
          },
        },
        update: {
          status: "ACTIVE",
          enrolledAt: new Date(),
        },
        create: {
          userId: USER_ID,
          courseId: course.id,
          status: "ACTIVE",
          amountPaid: course.price,
          progress: Math.floor(Math.random() * 50),
          enrolledAt: new Date(),
        },
      });
      console.log(`✅ Enrolled in: ${course.title}`);
      console.log(`   Channel ID: ${course.channel?.id || "No channel"}`);
    } catch (error: any) {
      console.log(`⚠️ Error enrolling in ${course.title}: ${error.message}`);
    }
  }

  // Get consultancy services
  const services = await prisma.consultancyService.findMany({
    where: { type: "SUBSCRIPTION" },
    include: { channel: true },
  });

  if (services.length > 0) {
    console.log(`\nFound ${services.length} subscription services\n`);

    // Subscribe to first service
    const serviceToSubscribe = services[0];
    try {
      const subscription = await prisma.consultancySubscription.upsert({
        where: {
          userId_serviceId: {
            userId: USER_ID,
            serviceId: serviceToSubscribe.id,
          },
        },
        update: {
          status: "ACTIVE",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        create: {
          userId: USER_ID,
          serviceId: serviceToSubscribe.id,
          status: "ACTIVE",
          amountPaid: serviceToSubscribe.price,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });
      console.log(`✅ Subscribed to: ${serviceToSubscribe.name}`);
      console.log(`   Channel ID: ${serviceToSubscribe.channel?.id || "No channel"}`);
    } catch (error: any) {
      console.log(`⚠️ Error subscribing to ${serviceToSubscribe.name}: ${error.message}`);
    }
  }

  // Print summary
  console.log("\n🎉 Done!");
  console.log("\nUser enrollments:");

  const userEnrollments = await prisma.courseEnrollment.findMany({
    where: { userId: USER_ID },
    include: { course: { include: { channel: true } } },
  });

  console.log(`\n📚 Course Enrollments (${userEnrollments.length}):`);
  userEnrollments.forEach((e) => {
    console.log(`   - ${e.course.title} [${e.status}]`);
    console.log(`     Channel: ${e.course.channel?.id || "None"}`);
  });

  const userSubscriptions = await prisma.consultancySubscription.findMany({
    where: { userId: USER_ID },
    include: { service: { include: { channel: true } } },
  });

  console.log(`\n💼 Consultancy Subscriptions (${userSubscriptions.length}):`);
  userSubscriptions.forEach((s) => {
    console.log(`   - ${s.service.name} [${s.status}]`);
    console.log(`     Channel: ${s.service.channel?.id || "None"}`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
