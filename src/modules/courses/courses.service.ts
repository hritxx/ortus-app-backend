import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCourseDto, UpdateCourseDto, VerifyPaymentDto, CreateWebinarDto } from "./dto";
import { CourseType, EnrollmentStatus } from "@prisma/client";
import { NotificationService } from "../notification/notification.service";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notificationService: NotificationService
  ) {
    const keyId = this.configService.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.configService.get<string>("RAZORPAY_KEY_SECRET");

    this.logger.log(`Initializing Razorpay with key_id: ${keyId ? keyId.substring(0, 10) + '...' : 'MISSING'}`);
    this.logger.log(`Razorpay key_secret: ${keySecret ? 'SET (' + keySecret.length + ' chars)' : 'MISSING'}`);

    if (!keyId || !keySecret) {
      this.logger.error('Razorpay credentials missing! Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars');
    }

    this.razorpay = new Razorpay({
      key_id: keyId || '',
      key_secret: keySecret || '',
    });
  }

  private checkRazorpayConfig() {
    const keyId = this.configService.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.configService.get<string>("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      throw new InternalServerErrorException('Payment service is not configured. Please contact support.');
    }
  }

  /**
   * List all courses with optional filters
   */
  async getAllCourses(
    userId?: string,
    type?: CourseType,
    category?: string
  ) {
    const where: any = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    const courses = await this.prisma.course.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                status: {
                  in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
                },
              },
            },
          },
        },
      },
    });

    // If userId is provided, check enrollment status for each course
    let userEnrollments: Record<string, boolean> = {};
    if (userId) {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: {
          userId,
          status: {
            in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
          },
        },
        select: {
          courseId: true,
        },
      });
      userEnrollments = enrollments.reduce(
        (acc, e) => ({ ...acc, [e.courseId]: true }),
        {}
      );
    }

    const data = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      type: course.type,
      category: course.category,
      duration: course.duration,
      startDate: course.startDate,
      endDate: course.endDate,
      price: course.price,
      currency: course.currency,
      maxStudents: course.maxStudents,
      instructor: course.instructor,
      enrollmentCount: course._count.enrollments,
      isEnrolled: userId ? !!userEnrollments[course.id] : false,
      createdAt: course.createdAt,
    }));

    return {
      success: true,
      data,
    };
  }

  /**
   * Get course details by ID
   */
  async getCourseById(courseId: string, userId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                status: {
                  in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
                },
              },
            },
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // Check if user is enrolled
    let enrollment = null;
    if (userId) {
      enrollment = await this.prisma.courseEnrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });
    }

    return {
      success: true,
      data: {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        type: course.type,
        category: course.category,
        duration: course.duration,
        startDate: course.startDate,
        endDate: course.endDate,
        price: course.price,
        currency: course.currency,
        maxStudents: course.maxStudents,
        syllabus: course.syllabus,
        instructor: course.instructor,
        metadata: course.metadata,
        enrollmentCount: course._count.enrollments,
        channelId: course.channel?.id,
        isEnrolled: enrollment
          ? enrollment.status === EnrollmentStatus.ACTIVE ||
            enrollment.status === EnrollmentStatus.COMPLETED
          : false,
        enrollmentStatus: enrollment?.status || null,
        createdAt: course.createdAt,
      },
    };
  }

  /**
   * Start enrollment - create Razorpay order
   */
  async enrollInCourse(userId: string, courseId: string) {
    // Check if course exists and is active
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                status: {
                  in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (!course.isActive) {
      throw new BadRequestException("Course is not available for enrollment");
    }

    // Check max students limit
    if (
      course.maxStudents &&
      course._count.enrollments >= course.maxStudents
    ) {
      throw new BadRequestException("Course is full");
    }

    // Check if user is already enrolled
    const existingEnrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      if (
        existingEnrollment.status === EnrollmentStatus.ACTIVE ||
        existingEnrollment.status === EnrollmentStatus.COMPLETED
      ) {
        throw new ConflictException("You are already enrolled in this course");
      }

      // If there's a pending enrollment, use that
      if (existingEnrollment.status === EnrollmentStatus.PENDING) {
        // Check Razorpay is configured
        this.checkRazorpayConfig();

        // Create new Razorpay order for existing pending enrollment
        try {
          const orderData = {
            amount: Math.round(course.price * 100), // Convert to paise
            currency: course.currency || "INR",
            receipt: `course_${courseId.slice(-8)}_${Date.now().toString().slice(-6)}`,
            notes: {
              courseId,
              userId,
              enrollmentId: existingEnrollment.id,
              type: "course_enrollment",
            },
          };

          this.logger.log(`Creating Razorpay order with data: ${JSON.stringify(orderData)}`);

          const order = await this.razorpay.orders.create(orderData);

          this.logger.log(
            `Razorpay order created: ${order.id} for enrollment: ${existingEnrollment.id}`
          );

          return {
            success: true,
            data: {
              orderId: order.id,
              amount: Number(order.amount) / 100,
              currency: order.currency,
              courseId,
              enrollmentId: existingEnrollment.id,
              razorpayKeyId: this.configService.get<string>("RAZORPAY_KEY_ID"),
            },
          };
        } catch (error: any) {
          this.logger.error(`Error creating Razorpay order: ${error?.message || error}`);
          this.logger.error(`Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error || {}))}`);
          throw new InternalServerErrorException(
            `Failed to create payment order: ${error?.message || 'Unknown error'}`
          );
        }
      }
    }

    // Check Razorpay is configured
    this.checkRazorpayConfig();

    // Create new enrollment with PENDING status
    const enrollment = await this.prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
        status: EnrollmentStatus.PENDING,
        amountPaid: course.price,
      },
    });

    // Create Razorpay order
    try {
      const orderData = {
        amount: Math.round(course.price * 100), // Convert to paise
        currency: course.currency || "INR",
        receipt: `course_${courseId.slice(-8)}_${Date.now().toString().slice(-6)}`,
        notes: {
          courseId,
          userId,
          enrollmentId: enrollment.id,
          type: "course_enrollment",
        },
      };

      this.logger.log(`Creating Razorpay order for new enrollment with data: ${JSON.stringify(orderData)}`);

      const order = await this.razorpay.orders.create(orderData);

      this.logger.log(
        `Razorpay order created: ${order.id} for enrollment: ${enrollment.id}`
      );

      return {
        success: true,
        data: {
          orderId: order.id,
          amount: Number(order.amount) / 100,
          currency: order.currency,
          courseId,
          enrollmentId: enrollment.id,
          razorpayKeyId: this.configService.get<string>("RAZORPAY_KEY_ID"),
        },
      };
    } catch (error: any) {
      // Clean up enrollment if order creation fails
      await this.prisma.courseEnrollment.delete({
        where: { id: enrollment.id },
      });

      this.logger.error(`Error creating Razorpay order: ${error?.message || error}`);
      this.logger.error(`Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error || {}))}`);
      throw new InternalServerErrorException(`Failed to create payment order: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify payment and activate enrollment
   */
  async verifyPayment(userId: string, courseId: string, dto: VerifyPaymentDto) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, enrollmentId } =
      dto;

    // Verify the enrollment belongs to the user
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: {
        id: enrollmentId,
        userId,
        courseId,
      },
      include: {
        course: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException("Enrollment not found");
    }

    if (enrollment.status === EnrollmentStatus.ACTIVE) {
      throw new BadRequestException("Enrollment is already active");
    }

    // Check if we're in development mode
    const isDevelopment = this.configService.get<string>("NODE_ENV") === "development";

    // Verify Razorpay signature (skip in development for easier testing)
    try {
      if (isDevelopment) {
        this.logger.warn(`Skipping signature verification in development mode for: ${razorpayPaymentId}`);
      } else {
        const generatedSignature = crypto
          .createHmac(
            "sha256",
            this.configService.get<string>("RAZORPAY_KEY_SECRET")
          )
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          this.logger.warn(
            `Payment verification failed for enrollment: ${enrollmentId}`
          );
          throw new BadRequestException("Invalid payment signature");
        }
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error("Payment verification error:", error);
      throw new InternalServerErrorException("Payment verification failed");
    }

    // Check if this is a mock payment (for skipping Razorpay API calls)
    const isMockPayment = razorpayPaymentId.startsWith("pay_") && /^pay_\d+$/.test(razorpayPaymentId);

    let paymentMethod = "mock";

    if (isDevelopment && isMockPayment) {
      this.logger.warn(`Skipping Razorpay fetch for mock payment in development: ${razorpayPaymentId}`);
    } else {
      // Fetch payment details from Razorpay to confirm
      const payment = await this.razorpay.payments.fetch(razorpayPaymentId);

      if (payment.status !== "captured") {
        throw new BadRequestException("Payment not captured");
      }
      paymentMethod = payment.method;
    }

    // Create a transaction record
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: "INVESTMENT", // Using INVESTMENT as the closest type
        amount: enrollment.amountPaid,
        status: "COMPLETED",
        paymentMethod: paymentMethod,
        paymentReference: razorpayPaymentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        description: `Course enrollment: ${enrollment.course.title}`,
        processedAt: new Date(),
        metadata: {
          type: "course_enrollment",
          courseId,
          enrollmentId,
        },
      },
    });

    // Activate the enrollment
    const updatedEnrollment = await this.prisma.courseEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.ACTIVE,
        transactionId: transaction.id,
        enrolledAt: new Date(),
      },
      include: {
        course: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Enrollment activated: ${enrollmentId} for user: ${userId}, course: ${courseId}`
    );

    return {
      success: true,
      data: {
        enrollmentId: updatedEnrollment.id,
        courseId: updatedEnrollment.courseId,
        courseTitle: updatedEnrollment.course.title,
        status: updatedEnrollment.status,
        channelId: updatedEnrollment.course.channel?.id,
        enrolledAt: updatedEnrollment.enrolledAt,
      },
    };
  }

  /**
   * Get user's enrolled courses
   */
  async getUserEnrollments(userId: string, status?: EnrollmentStatus) {
    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    } else {
      // By default, show active and completed enrollments
      where.status = {
        in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
      };
    }

    const enrollments = await this.prisma.courseEnrollment.findMany({
      where,
      include: {
        course: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        enrolledAt: "desc",
      },
    });

    return {
      success: true,
      data: enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        courseId: enrollment.courseId,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          description: enrollment.course.description,
          thumbnail: enrollment.course.thumbnail,
          type: enrollment.course.type,
          category: enrollment.course.category,
          duration: enrollment.course.duration,
          instructor: enrollment.course.instructor,
          channelId: enrollment.course.channel?.id,
        },
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        expiresAt: enrollment.expiresAt,
      })),
    };
  }

  /**
   * Check enrollment status for a specific course
   */
  async getEnrollmentStatus(userId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      include: {
        course: {
          include: {
            channel: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      return {
        success: true,
        data: {
          isEnrolled: false,
          status: null,
          channelId: null,
        },
      };
    }

    return {
      success: true,
      data: {
        isEnrolled:
          enrollment.status === EnrollmentStatus.ACTIVE ||
          enrollment.status === EnrollmentStatus.COMPLETED,
        status: enrollment.status,
        enrollmentId: enrollment.id,
        progress: enrollment.progress,
        channelId: enrollment.course.channel?.id,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        expiresAt: enrollment.expiresAt,
      },
    };
  }

  /**
   * Admin: Create a new course
   */
  async createCourse(createCourseDto: CreateCourseDto) {
    const course = await this.prisma.course.create({
      data: {
        title: createCourseDto.title,
        description: createCourseDto.description,
        thumbnail: createCourseDto.thumbnail,
        type: createCourseDto.type,
        category: createCourseDto.category,
        duration: createCourseDto.duration,
        startDate: createCourseDto.startDate
          ? new Date(createCourseDto.startDate)
          : null,
        endDate: createCourseDto.endDate
          ? new Date(createCourseDto.endDate)
          : null,
        price: createCourseDto.price,
        currency: createCourseDto.currency || "INR",
        maxStudents: createCourseDto.maxStudents,
        syllabus: createCourseDto.syllabus,
        instructor: createCourseDto.instructor,
        metadata: createCourseDto.metadata,
        isActive: true,
      },
    });

    this.logger.log(`Course created: ${course.id}`);

    return {
      success: true,
      data: course,
    };
  }

  /**
   * Admin: Update a course
   */
  async updateCourse(courseId: string, updateCourseDto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(updateCourseDto.title && { title: updateCourseDto.title }),
        ...(updateCourseDto.description && {
          description: updateCourseDto.description,
        }),
        ...(updateCourseDto.thumbnail !== undefined && {
          thumbnail: updateCourseDto.thumbnail,
        }),
        ...(updateCourseDto.type && { type: updateCourseDto.type }),
        ...(updateCourseDto.category && { category: updateCourseDto.category }),
        ...(updateCourseDto.duration && { duration: updateCourseDto.duration }),
        ...(updateCourseDto.startDate !== undefined && {
          startDate: updateCourseDto.startDate
            ? new Date(updateCourseDto.startDate)
            : null,
        }),
        ...(updateCourseDto.endDate !== undefined && {
          endDate: updateCourseDto.endDate
            ? new Date(updateCourseDto.endDate)
            : null,
        }),
        ...(updateCourseDto.price !== undefined && {
          price: updateCourseDto.price,
        }),
        ...(updateCourseDto.currency && { currency: updateCourseDto.currency }),
        ...(updateCourseDto.isActive !== undefined && {
          isActive: updateCourseDto.isActive,
        }),
        ...(updateCourseDto.maxStudents !== undefined && {
          maxStudents: updateCourseDto.maxStudents,
        }),
        ...(updateCourseDto.syllabus !== undefined && {
          syllabus: updateCourseDto.syllabus,
        }),
        ...(updateCourseDto.instructor !== undefined && {
          instructor: updateCourseDto.instructor,
        }),
        ...(updateCourseDto.metadata !== undefined && {
          metadata: updateCourseDto.metadata,
        }),
      },
    });

    this.logger.log(`Course updated: ${courseId}`);

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Admin: Delete (soft delete) a course
   */
  async deleteCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        isActive: false,
      },
    });

    this.logger.log(`Course deleted (soft): ${courseId}`);

    return {
      success: true,
      message: "Course deleted successfully",
    };
  }

  async createWebinar(adminId: string, dto: CreateWebinarDto) {
    const { title, description, scheduledAt, duration, meetingLink, courseId } = dto;

    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course) {
        throw new NotFoundException("Course not found");
      }
    }

    const webinar = await this.prisma.webinar.create({
      data: {
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        duration,
        meetingLink,
        courseId: courseId || null,
      },
    });

    this.logger.log(`Webinar created: ${webinar.id} (${title}) by admin ${adminId}`);

    // Trigger push notifications asynchronously
    setTimeout(async () => {
      try {
        if (courseId) {
          const enrollments = await this.prisma.courseEnrollment.findMany({
            where: { courseId, status: "ACTIVE" },
            select: { userId: true },
          });

          for (const enr of enrollments) {
            await this.notificationService.createNotification({
              userId: enr.userId,
              title: "New Masterclass Scheduled 🎓",
              body: `A new live session "${title}" is scheduled for your course on ${new Date(scheduledAt).toLocaleString()}`,
              type: "INFO",
              category: "INVESTMENT",
              data: { webinarId: webinar.id, meetingLink },
            });
          }
        } else {
          const users = await this.prisma.user.findMany({
            where: { isActive: true },
            select: { id: true },
          });

          for (const u of users) {
            await this.notificationService.createNotification({
              userId: u.id,
              title: "New Live Webinar Scheduled 📅",
              body: `Join our global webinar "${title}" on ${new Date(scheduledAt).toLocaleString()}`,
              type: "INFO",
              category: "SYSTEM",
              data: { webinarId: webinar.id, meetingLink },
            });
          }
        }
      } catch (err) {
        console.error("Failed to dispatch webinar notifications:", err);
      }
    }, 100);

    return {
      success: true,
      webinar,
    };
  }

  async getUpcomingWebinars(userId: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userId, status: "ACTIVE" },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    const upcoming = await this.prisma.webinar.findMany({
      where: {
        isActive: true,
        scheduledAt: { gte: new Date() },
        OR: [
          { courseId: null },
          { courseId: { in: courseIds } },
        ],
      },
      include: {
        course: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    return {
      success: true,
      count: upcoming.length,
      webinars: upcoming,
    };
  }
}
