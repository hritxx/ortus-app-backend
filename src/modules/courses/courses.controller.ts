import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CoursesService } from "./courses.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateCourseDto,
  UpdateCourseDto,
  VerifyPaymentDto,
  CreateWebinarDto,
} from "./dto";
import { CourseType, EnrollmentStatus } from "@prisma/client";

@Controller("courses")
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  /**
   * GET /api/courses - List all courses
   * Optional filters: type, category
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllCourses(
    @Request() req,
    @Query("type") type?: CourseType,
    @Query("category") category?: string
  ) {
    return this.coursesService.getAllCourses(req.user.id, type, category);
  }

  /**
   * GET /api/courses/enrolled - Get user's enrolled courses
   * Must be defined before :id route to avoid conflict
   */
  @Get("enrolled")
  @UseGuards(JwtAuthGuard)
  async getUserEnrollments(
    @Request() req,
    @Query("status") status?: EnrollmentStatus
  ) {
    return this.coursesService.getUserEnrollments(req.user.id, status);
  }

  /**
   * GET /api/courses/:id - Get course details
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getCourseById(@Request() req, @Param("id") courseId: string) {
    return this.coursesService.getCourseById(courseId, req.user.id);
  }

  /**
   * GET /api/courses/:id/enrollment-status - Check enrollment status
   */
  @Get(":id/enrollment-status")
  @UseGuards(JwtAuthGuard)
  async getEnrollmentStatus(@Request() req, @Param("id") courseId: string) {
    return this.coursesService.getEnrollmentStatus(req.user.id, courseId);
  }

  /**
   * POST /api/courses/:id/enroll - Start enrollment (create Razorpay order)
   */
  @Post(":id/enroll")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async enrollInCourse(@Request() req, @Param("id") courseId: string) {
    return this.coursesService.enrollInCourse(req.user.id, courseId);
  }

  /**
   * POST /api/courses/:id/verify-payment - Verify payment and activate enrollment
   */
  @Post(":id/verify-payment")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Request() req,
    @Param("id") courseId: string,
    @Body() verifyPaymentDto: VerifyPaymentDto
  ) {
    return this.coursesService.verifyPayment(
      req.user.id,
      courseId,
      verifyPaymentDto
    );
  }

  /**
   * POST /api/courses - Create a new course (Admin)
   * Note: In production, add admin guard
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCourse(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.createCourse(createCourseDto);
  }

  /**
   * PUT /api/courses/:id - Update a course (Admin)
   * Note: In production, add admin guard
   */
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async updateCourse(
    @Param("id") courseId: string,
    @Body() updateCourseDto: UpdateCourseDto
  ) {
    return this.coursesService.updateCourse(courseId, updateCourseDto);
  }

  /**
   * DELETE /api/courses/:id - Delete a course (Admin, soft delete)
   * Note: In production, add admin guard
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteCourse(@Param("id") courseId: string) {
    return this.coursesService.deleteCourse(courseId);
  }

  @Post("webinars")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createWebinar(@Request() req, @Body() createWebinarDto: CreateWebinarDto) {
    return this.coursesService.createWebinar(req.user.id, createWebinarDto);
  }

  @Get("webinars/upcoming")
  @UseGuards(JwtAuthGuard)
  async getUpcomingWebinars(@Request() req) {
    return this.coursesService.getUpcomingWebinars(req.user.id);
  }
}
