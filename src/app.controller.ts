import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      message: "Ortus Finance Backend is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get()
  getRoot() {
    return {
      message: "Ortus Finance API",
      version: "1.0.0",
      docs: "/api/v1/docs",
    };
  }
}
