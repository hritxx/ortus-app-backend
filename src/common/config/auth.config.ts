import { registerAs } from "@nestjs/config";

export const authConfig = registerAs("auth", () => ({
  jwtSecret: process.env.JWT_SECRET || "default-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "default-refresh-secret-change-in-production",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),
  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || "3", 10),
}));
