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
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ChannelsService } from "./channels.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreatePostDto, UpdatePostDto } from "./dto/create-post.dto";
import { ReactionDto } from "./dto/reaction.dto";

@Controller("channels")
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  /**
   * Get all channels accessible to the current user
   */
  @Get()
  async getUserChannels(@Request() req) {
    return this.channelsService.getUserChannels(req.user.id);
  }

  /**
   * Get channel details by ID
   */
  @Get(":id")
  async getChannelById(@Request() req, @Param("id") channelId: string) {
    return this.channelsService.getChannelById(req.user.id, channelId);
  }

  /**
   * Check if user has access to a channel
   */
  @Get(":id/access")
  async checkAccess(@Request() req, @Param("id") channelId: string) {
    return this.channelsService.checkAccess(req.user.id, channelId);
  }

  /**
   * Get channel posts with pagination
   */
  @Get(":id/posts")
  async getChannelPosts(
    @Request() req,
    @Param("id") channelId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    return this.channelsService.getChannelPosts(
      req.user.id,
      channelId,
      page,
      Math.min(limit, 50) // Cap at 50 items per page
    );
  }

  // ==================== REACTION ENDPOINTS ====================

  /**
   * Add or toggle reaction to a post
   */
  @Post("posts/:postId/react")
  @HttpCode(HttpStatus.OK)
  async addReaction(
    @Request() req,
    @Param("postId") postId: string,
    @Body() reactionDto: ReactionDto
  ) {
    return this.channelsService.addReaction(req.user.id, postId, reactionDto);
  }

  /**
   * Remove a specific reaction from a post
   */
  @Delete("posts/:postId/react/:emoji")
  async removeReaction(
    @Request() req,
    @Param("postId") postId: string,
    @Param("emoji") emoji: string
  ) {
    return this.channelsService.removeReaction(req.user.id, postId, emoji);
  }

  /**
   * Get all reactions for a post
   */
  @Get("posts/:postId/reactions")
  async getPostReactions(@Request() req, @Param("postId") postId: string) {
    return this.channelsService.getPostReactions(req.user.id, postId);
  }

  // ==================== ADMIN ENDPOINTS ====================
  // TODO: Add proper admin guard/role check when implemented

  /**
   * Create a new post in a channel (Admin only)
   */
  @Post(":id/posts")
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @Request() req,
    @Param("id") channelId: string,
    @Body() createPostDto: CreatePostDto
  ) {
    return this.channelsService.createPost(req.user.id, channelId, createPostDto);
  }

  /**
   * Update an existing post (Admin only)
   */
  @Put(":id/posts/:postId")
  async updatePost(
    @Request() req,
    @Param("id") channelId: string,
    @Param("postId") postId: string,
    @Body() updatePostDto: UpdatePostDto
  ) {
    return this.channelsService.updatePost(
      req.user.id,
      channelId,
      postId,
      updatePostDto
    );
  }

  /**
   * Delete a post (Admin only)
   */
  @Delete(":id/posts/:postId")
  async deletePost(
    @Request() req,
    @Param("id") channelId: string,
    @Param("postId") postId: string
  ) {
    return this.channelsService.deletePost(req.user.id, channelId, postId);
  }

  /**
   * Toggle pin status of a post (Admin only)
   */
  @Put(":id/posts/:postId/pin")
  async togglePinPost(
    @Request() req,
    @Param("id") channelId: string,
    @Param("postId") postId: string
  ) {
    return this.channelsService.togglePinPost(req.user.id, channelId, postId);
  }
}
