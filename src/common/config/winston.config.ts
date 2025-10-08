import { createLogger, format, transports } from "winston";

export const createWinstonLogger = () => {
  const isDevelopment = process.env.NODE_ENV === "development";

  return createLogger({
    level: isDevelopment ? "debug" : "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.colorize({ all: isDevelopment }),
      format.printf(({ timestamp, level, message, context, stack }) => {
        const contextStr = context ? `[${context}] ` : "";
        const stackStr = stack ? `\n${stack}` : "";
        return `${timestamp} ${level}: ${contextStr}${message}${stackStr}`;
      })
    ),
    transports: [
      new transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
      ...(isDevelopment
        ? []
        : [
            new transports.File({
              filename: "logs/error.log",
              level: "error",
              maxsize: 5242880, // 5MB
              maxFiles: 5,
            }),
            new transports.File({
              filename: "logs/combined.log",
              maxsize: 5242880, // 5MB
              maxFiles: 5,
            }),
          ]),
    ],
  });
};
