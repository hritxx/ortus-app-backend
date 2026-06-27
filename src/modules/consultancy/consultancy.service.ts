import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SubscribeDto, BookSessionDto, VerifyPaymentDto } from "./dto";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class ConsultancyService {
  private readonly logger = new Logger(ConsultancyService.name);
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    const keyId = this.configService.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.configService.get<string>("RAZORPAY_KEY_SECRET");

    this.logger.log(`Initializing Razorpay with key_id: ${keyId ? keyId.substring(0, 10) + '...' : 'MISSING'}`);

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

  async getServices(userId?: string, type?: string) {
    const where: any = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    const services = await this.prisma.consultancyService.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    // If userId provided, check subscription status for each service
    let servicesWithStatus = services;
    if (userId) {
      const subscriptions = await this.prisma.consultancySubscription.findMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        select: {
          serviceId: true,
        },
      });

      const activeServiceIds = new Set(subscriptions.map((s) => s.serviceId));

      servicesWithStatus = services.map((service) => ({
        ...service,
        isSubscribed: activeServiceIds.has(service.id),
      }));
    }

    return {
      success: true,
      count: servicesWithStatus.length,
      data: servicesWithStatus,
    };
  }

  async getServiceById(serviceId: string, userId?: string) {
    const service = await this.prisma.consultancyService.findUnique({
      where: { id: serviceId },
      include: {
        channel: true,
      },
    });

    if (!service) {
      throw new NotFoundException("Consultancy service not found");
    }

    // Check if user has active subscription
    let subscription = null;
    if (userId) {
      subscription = await this.prisma.consultancySubscription.findFirst({
        where: {
          userId,
          serviceId,
          status: "ACTIVE",
        },
      });
    }

    return {
      success: true,
      data: {
        ...service,
        isSubscribed: !!subscription,
        subscription,
      },
    };
  }

  async subscribe(userId: string, serviceId: string, subscribeDto: SubscribeDto) {
    const service = await this.prisma.consultancyService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException("Consultancy service not found");
    }

    if (!service.isActive) {
      throw new BadRequestException("This service is not currently available");
    }

    // Check for existing subscription (any status)
    const existingSubscription = await this.prisma.consultancySubscription.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });

    if (existingSubscription?.status === "ACTIVE") {
      throw new BadRequestException("You already have an active subscription to this service");
    }

    // Check Razorpay is configured
    this.checkRazorpayConfig();

    try {
      // Create Razorpay order
      const shortReceipt = `sub_${Date.now().toString().slice(-10)}`;
      const order = await this.razorpay.orders.create({
        amount: Math.round(service.price * 100), // Convert to paise (must be integer)
        currency: service.currency || "INR",
        receipt: shortReceipt,
        notes: {
          type: "consultancy_subscription",
          serviceId: serviceId,
          userId: userId,
        },
      });

      // Create or update subscription record
      const subscription = await this.prisma.consultancySubscription.upsert({
        where: {
          userId_serviceId: {
            userId,
            serviceId,
          },
        },
        update: {
          status: "PENDING",
          amountPaid: service.price,
          autoRenew: subscribeDto.autoRenew ?? false,
        },
        create: {
          userId,
          serviceId,
          status: "PENDING",
          amountPaid: service.price,
          autoRenew: subscribeDto.autoRenew ?? false,
        },
      });

      this.logger.log(
        `Subscription order created: ${order.id} for user: ${userId}, service: ${serviceId}`
      );

      return {
        success: true,
        data: {
          orderId: order.id,
          amount: Number(order.amount) / 100,
          currency: order.currency,
          subscriptionId: subscription.id,
          razorpayKeyId: this.configService.get<string>("RAZORPAY_KEY_ID"),
        },
      };
    } catch (error: any) {
      this.logger.error("Error creating subscription order:", error);
      throw new InternalServerErrorException("Failed to create subscription order");
    }
  }

  async verifyPayment(userId: string, serviceId: string, verifyPaymentDto: VerifyPaymentDto) {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      subscriptionId,
      sessionId,
    } = verifyPaymentDto;

    try {
      // Check if we're in development mode
      const isDevelopment = this.configService.get<string>("NODE_ENV") === "development";

      // Skip signature verification in development for easier testing
      if (isDevelopment) {
        this.logger.warn(`Skipping signature verification in development mode for: ${razorpayPaymentId}`);
      } else {
        // Generate signature for verification
        const generatedSignature = crypto
          .createHmac("sha256", this.configService.get<string>("RAZORPAY_KEY_SECRET"))
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          this.logger.warn(`Payment verification failed for user: ${userId}`);
          throw new BadRequestException("Invalid payment signature");
        }
      }

      // Determine if this is a subscription or session payment
      if (sessionId) {
        return this.activateSession(userId, sessionId, razorpayPaymentId);
      }

      // Handle subscription activation
      return this.activateSubscription(userId, serviceId, subscriptionId, razorpayPaymentId);
    } catch (error: any) {
      this.logger.error("Payment verification error:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException("Payment verification failed");
    }
  }

  private async activateSubscription(
    userId: string,
    serviceId: string,
    subscriptionId: string | undefined,
    paymentId: string
  ) {
    const service = await this.prisma.consultancyService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException("Consultancy service not found");
    }

    // Find the pending subscription
    let subscription;
    if (subscriptionId) {
      subscription = await this.prisma.consultancySubscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
          status: "PENDING",
        },
      });
    } else {
      subscription = await this.prisma.consultancySubscription.findFirst({
        where: {
          userId,
          serviceId,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    if (!subscription) {
      throw new NotFoundException("Pending subscription not found");
    }

    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    if (service.duration) {
      endDate.setDate(endDate.getDate() + service.duration);
    } else {
      // Default to 30 days if duration not specified
      endDate.setDate(endDate.getDate() + 30);
    }

    // Activate the subscription
    const updatedSubscription = await this.prisma.consultancySubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        transactionId: paymentId,
        startDate,
        endDate,
      },
      include: {
        service: true,
      },
    });

    this.logger.log(
      `Subscription activated: ${subscription.id} for user: ${userId}`
    );

    return {
      success: true,
      verified: true,
      data: {
        subscription: updatedSubscription,
        message: "Subscription activated successfully",
      },
    };
  }

  private async activateSession(userId: string, sessionId: string, paymentId: string) {
    const session = await this.prisma.oneOnOneSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: "SCHEDULED",
        transactionId: null,
      },
    });

    if (!session) {
      throw new NotFoundException("Pending session not found");
    }

    const updatedSession = await this.prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        transactionId: paymentId,
      },
      include: {
        service: true,
      },
    });

    this.logger.log(`Session payment confirmed: ${sessionId} for user: ${userId}`);

    return {
      success: true,
      verified: true,
      data: {
        session: updatedSession,
        message: "Session booking confirmed",
      },
    };
  }

  async getUserSubscriptions(userId: string, status?: string) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const subscriptions = await this.prisma.consultancySubscription.findMany({
      where,
      include: {
        service: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    };
  }

  async getSubscriptionStatus(userId: string, serviceId: string) {
    const subscription = await this.prisma.consultancySubscription.findFirst({
      where: {
        userId,
        serviceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        service: true,
      },
    });

    return {
      success: true,
      data: {
        isSubscribed: subscription?.status === "ACTIVE",
        subscription,
      },
    };
  }

  async getAvailableSlots(serviceId: string, date: string) {
    const service = await this.prisma.consultancyService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException("Consultancy service not found");
    }

    if (service.type !== "SESSION") {
      throw new BadRequestException("This service does not support session booking");
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get existing sessions for the date
    const existingSessions = await this.prisma.oneOnOneSession.findMany({
      where: {
        serviceId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
    });

    // Generate available time slots (9 AM to 6 PM with 1-hour intervals)
    const slots = this.generateTimeSlots(targetDate, existingSessions);

    return {
      success: true,
      date: date,
      data: slots,
    };
  }

  private generateTimeSlots(
    date: Date,
    existingSessions: { scheduledAt: Date; duration: number }[]
  ) {
    const slots: { time: string; available: boolean }[] = [];
    const now = new Date();

    // Generate slots from 9 AM to 6 PM
    for (let hour = 9; hour <= 18; hour++) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);

      // Check if slot is in the past
      if (slotTime <= now) {
        continue;
      }

      // Check if slot conflicts with existing sessions
      const isBooked = existingSessions.some((session) => {
        const sessionStart = new Date(session.scheduledAt);
        const sessionEnd = new Date(sessionStart.getTime() + session.duration * 60000);
        return slotTime >= sessionStart && slotTime < sessionEnd;
      });

      slots.push({
        time: slotTime.toISOString(),
        available: !isBooked,
      });
    }

    return slots;
  }

  async bookSession(userId: string, serviceId: string, bookSessionDto: BookSessionDto) {
    const service = await this.prisma.consultancyService.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException("Consultancy service not found");
    }

    if (service.type !== "SESSION") {
      throw new BadRequestException("This service does not support session booking");
    }

    if (!service.isActive) {
      throw new BadRequestException("This service is not currently available");
    }

    const scheduledAt = new Date(bookSessionDto.scheduledAt);

    // Validate the scheduled time is in the future
    if (scheduledAt <= new Date()) {
      throw new BadRequestException("Session must be scheduled for a future time");
    }

    // Check for existing booking at the same time
    const existingSession = await this.prisma.oneOnOneSession.findFirst({
      where: {
        serviceId,
        scheduledAt,
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
    });

    if (existingSession) {
      throw new BadRequestException("This time slot is already booked");
    }

    // Check if user has too many pending sessions
    const pendingSessions = await this.prisma.oneOnOneSession.count({
      where: {
        userId,
        serviceId,
        status: "SCHEDULED",
        transactionId: null, // Unpaid sessions
      },
    });

    if (pendingSessions >= 3) {
      throw new BadRequestException(
        "You have too many pending session bookings. Please complete payment for existing bookings first."
      );
    }

    // Check Razorpay is configured
    this.checkRazorpayConfig();

    try {
      // Create Razorpay order
      const shortReceipt = `ses_${Date.now().toString().slice(-10)}`;
      const order = await this.razorpay.orders.create({
        amount: Math.round(service.price * 100), // Convert to paise (must be integer)
        currency: service.currency || "INR",
        receipt: shortReceipt,
        notes: {
          type: "session_booking",
          serviceId: serviceId,
          userId: userId,
          scheduledAt: scheduledAt.toISOString(),
        },
      });

      // Create session record
      const session = await this.prisma.oneOnOneSession.create({
        data: {
          userId,
          serviceId,
          scheduledAt,
          duration: bookSessionDto.duration,
          status: "SCHEDULED",
          notes: bookSessionDto.topic
            ? `Topic: ${bookSessionDto.topic}${bookSessionDto.notes ? `\n${bookSessionDto.notes}` : ""}`
            : bookSessionDto.notes,
          amountPaid: service.price,
        },
        include: {
          service: true,
        },
      });

      this.logger.log(
        `Session booking order created: ${order.id} for user: ${userId}, service: ${serviceId}`
      );

      return {
        success: true,
        data: {
          orderId: order.id,
          amount: Number(order.amount) / 100,
          currency: order.currency,
          sessionId: session.id,
          session,
          razorpayKeyId: this.configService.get<string>("RAZORPAY_KEY_ID"),
        },
      };
    } catch (error: any) {
      this.logger.error("Error creating session booking order:", error);
      throw new InternalServerErrorException("Failed to create session booking");
    }
  }

  async getUserSessions(userId: string, status?: string) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const sessions = await this.prisma.oneOnOneSession.findMany({
      where,
      include: {
        service: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    // Separate into upcoming and past sessions
    const now = new Date();
    const upcomingSessions = sessions.filter(
      (s) => new Date(s.scheduledAt) > now && s.status === "SCHEDULED"
    );
    const pastSessions = sessions.filter(
      (s) => new Date(s.scheduledAt) <= now || s.status !== "SCHEDULED"
    );

    return {
      success: true,
      count: sessions.length,
      data: {
        upcoming: upcomingSessions,
        past: pastSessions,
        all: sessions,
      },
    };
  }

  async getSessionById(userId: string, sessionId: string) {
    const session = await this.prisma.oneOnOneSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        service: true,
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return {
      success: true,
      data: session,
    };
  }

  async cancelSession(userId: string, sessionId: string) {
    const session = await this.prisma.oneOnOneSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: "SCHEDULED",
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found or cannot be cancelled");
    }

    // Check if session is within 24 hours (cancellation policy)
    const scheduledTime = new Date(session.scheduledAt);
    const hoursUntilSession = (scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilSession < 24) {
      throw new BadRequestException(
        "Sessions cannot be cancelled within 24 hours of the scheduled time"
      );
    }

    const updatedSession = await this.prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      include: {
        service: true,
      },
    });

    this.logger.log(`Session cancelled: ${sessionId} by user: ${userId}`);

    return {
      success: true,
      data: {
        session: updatedSession,
        message: "Session cancelled successfully. Refund will be processed within 5-7 business days.",
      },
    };
  }
}
