import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EmailService } from "../../common/services/email.service";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CompleteKycDto,
  UpdateProfileDto,
} from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        emailVerified: false,
        phoneVerified: false,
        tokenBalance: 0,
      },
    });

    // Store OTP
    await this.prisma.otpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        otp,
        type: "EMAIL",
        purpose: "REGISTRATION",
        expiresAt: otpExpiresAt,
      },
    });

    // Send OTP email using Brevo SMTP
    try {
      console.log(`[AUTH] Sending OTP email to ${user.email}, OTP: ${otp}`);
      await this.emailService.sendOtpEmail(user.email, otp, user.name);
      console.log(`[AUTH] ✅ OTP email sent successfully to ${user.email}`);
    } catch (error) {
      console.error(
        `[AUTH] ❌ Failed to send OTP email to ${user.email}:`,
        error
      );
      // Don't fail registration if email fails, but log it
      // In production, you might want to queue this for retry
    }

    return {
      success: true,
      message:
        "Registration successful. Please verify your email with the OTP sent.",
      userId: user.id,
      // In production, don't send OTP in response
      // otp: otp, // Only for testing
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.emailVerified) {
      throw new BadRequestException("Email already verified");
    }

    // Find valid OTP
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        otp,
        type: "EMAIL",
        purpose: "REGISTRATION",
        isVerified: false,
        isExpired: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    // Mark OTP as verified
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true },
    });

    // Update user
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Save refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      success: true,
      message: "Email verified successfully",
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        kycStatus: user.kycStatus,
        tokenBalance: user.tokenBalance,
        panNumber: user.panNumber,
        aadhaarNumber: user.aadhaarNumber,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        annualIncome: user.annualIncome,
        bankAccount: user.bankAccount,
        ifscCode: user.ifscCode,
        bankName: user.bankName,
        accountHolder: user.accountHolder,
        createdAt: user.createdAt,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        "Please verify your email before logging in"
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Save refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        resource: "USER",
        resourceId: user.id,
        metadata: { method: "email_password" },
      },
    });

    return {
      success: true,
      message: "Login successful",
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        kycStatus: user.kycStatus,
        tokenBalance: user.tokenBalance,
        panNumber: user.panNumber,
        aadhaarNumber: user.aadhaarNumber,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        annualIncome: user.annualIncome,
        bankAccount: user.bankAccount,
        ifscCode: user.ifscCode,
        bankName: user.bankName,
        accountHolder: user.accountHolder,
        createdAt: user.createdAt,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "LOGOUT",
        resource: "USER",
        resourceId: userId,
      },
    });

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshToken
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.email);

      // Update refresh token
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        success: true,
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        success: true,
        message: "If the email exists, an OTP has been sent",
      };
    }

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.otpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        otp,
        type: "EMAIL",
        purpose: "PASSWORD_RESET",
        expiresAt: otpExpiresAt,
      },
    });

    // Send OTP email for password reset
    try {
      await this.emailService.sendOtpEmail(user.email, otp, user.name);
    } catch (error) {
      console.error(
        `Failed to send password reset OTP to ${user.email}:`,
        error
      );
      // Don't fail the request if email fails
    }

    return {
      success: true,
      message: "If the email exists, an OTP has been sent",
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Find valid OTP
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        otp,
        type: "EMAIL",
        purpose: "PASSWORD_RESET",
        isVerified: false,
        isExpired: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null, // Invalidate all sessions
      },
    });

    // Mark OTP as verified
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET",
        resource: "USER",
        resourceId: user.id,
      },
    });

    return {
      success: true,
      message: "Password reset successfully",
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        "New password must be different from current password"
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate refresh token (force re-login on other devices)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "PASSWORD_CHANGED",
        resource: "USER",
        resourceId: userId,
      },
    });

    return {
      success: true,
      message: "Password changed successfully. Please login again.",
    };
  }

  async completeKyc(userId: string, completeKycDto: CompleteKycDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.kycStatus === "APPROVED") {
      throw new BadRequestException("KYC already completed");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...completeKycDto,
        kycStatus: "PENDING", // Would be APPROVED after admin verification
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "KYC_SUBMITTED",
        resource: "USER",
        resourceId: userId,
        metadata: { panNumber: completeKycDto.panNumber },
      },
    });

    return {
      success: true,
      message: "KYC information submitted successfully. Verification pending.",
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        kycStatus: true,
        tokenBalance: true,
        panNumber: true,
        aadhaarNumber: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        dateOfBirth: true,
        occupation: true,
        annualIncome: true,
        bankAccount: true,
        ifscCode: true,
        bankName: true,
        accountHolder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        kycStatus: true,
        tokenBalance: true,
        panNumber: true,
        aadhaarNumber: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        dateOfBirth: true,
        occupation: true,
        annualIncome: true,
        bankAccount: true,
        ifscCode: true,
        bankName: true,
        accountHolder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    };
  }

  // Helper methods
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_SECRET"),
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") || "15m",
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn:
          this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "7d",
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    return null;
  }
}
