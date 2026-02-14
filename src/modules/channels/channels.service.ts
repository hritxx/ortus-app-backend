import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreatePostDto, UpdatePostDto } from "./dto/create-post.dto";
import { ReactionDto } from "./dto/reaction.dto";

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user has access to a channel based on enrollment or subscription
   */
  async checkChannelAccess(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { course: true, service: true },
    });

    if (!channel) {
      return false;
    }

    if (!channel.isActive) {
      return false;
    }

    if (channel.courseId) {
      // Check course enrollment
      const enrollment = await this.prisma.courseEnrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: channel.courseId },
        },
      });
      return enrollment?.status === "ACTIVE";
    }

    if (channel.serviceId) {
      // Check consultancy subscription
      const subscription = await this.prisma.consultancySubscription.findUnique({
        where: {
          userId_serviceId: { userId, serviceId: channel.serviceId },
        },
      });
      return subscription?.status === "ACTIVE";
    }

    return false;
  }

  /**
   * Get all channels accessible to the user
   */
  async getUserChannels(userId: string) {
    // Get user's active course enrollments
    const courseEnrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: { courseId: true },
    });

    // Get user's active consultancy subscriptions
    const subscriptions = await this.prisma.consultancySubscription.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: { serviceId: true },
    });

    const courseIds = courseEnrollments.map((e) => e.courseId);
    const serviceIds = subscriptions.map((s) => s.serviceId);

    // Get channels for enrolled courses and subscribed services
    const channels = await this.prisma.channel.findMany({
      where: {
        isActive: true,
        OR: [
          { courseId: { in: courseIds } },
          { serviceId: { in: serviceIds } },
        ],
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            type: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      success: true,
      count: channels.length,
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        thumbnail: channel.thumbnail,
        course: channel.course,
        service: channel.service,
        lastPost: channel.posts[0] || null,
      })),
    };
  }

  /**
   * Get channel details with access check
   */
  async getChannelById(userId: string, channelId: string) {
    const hasAccess = await this.checkChannelAccess(userId, channelId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this channel");
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            type: true,
            description: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    // Get pinned posts count
    const pinnedCount = await this.prisma.channelPost.count({
      where: { channelId, isPinned: true },
    });

    // Get total posts count
    const totalPosts = await this.prisma.channelPost.count({
      where: { channelId },
    });

    return {
      success: true,
      channel: {
        ...channel,
        pinnedCount,
        totalPosts,
      },
    };
  }

  /**
   * Get channel posts with pagination
   */
  async getChannelPosts(
    userId: string,
    channelId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const hasAccess = await this.checkChannelAccess(userId, channelId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this channel");
    }

    const skip = (page - 1) * limit;

    // Get posts with reactions
    const [posts, total] = await Promise.all([
      this.prisma.channelPost.findMany({
        where: { channelId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          reactions: true,
        },
      }),
      this.prisma.channelPost.count({ where: { channelId } }),
    ]);

    // Process posts to include reaction counts and user's reaction
    const postsWithReactions = posts.map((post) => {
      // Count reactions by emoji
      const reactionCounts: Record<string, number> = {};
      let userReaction: string | null = null;

      post.reactions.forEach((reaction) => {
        reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
        if (reaction.userId === userId) {
          userReaction = reaction.emoji;
        }
      });

      return {
        id: post.id,
        type: post.type,
        content: post.content,
        attachments: post.attachments,
        meetingLink: post.meetingLink,
        eventTime: post.eventTime,
        postedBy: post.postedBy,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        reactions: {
          count: reactionCounts,
          total: post.reactions.length,
        },
        userReaction,
      };
    });

    return {
      success: true,
      data: {
        posts: postsWithReactions,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + posts.length < total,
        },
      },
    };
  }

  /**
   * Check if user has access to a channel
   */
  async checkAccess(userId: string, channelId: string) {
    const hasAccess = await this.checkChannelAccess(userId, channelId);
    return {
      success: true,
      hasAccess,
    };
  }

  /**
   * Add reaction to a post
   */
  async addReaction(userId: string, postId: string, reactionDto: ReactionDto) {
    const { emoji } = reactionDto;

    // Verify post exists
    const post = await this.prisma.channelPost.findUnique({
      where: { id: postId },
      include: { channel: true },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify user has access to the channel
    const hasAccess = await this.checkChannelAccess(userId, post.channelId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this channel");
    }

    // Check if reaction already exists (toggle behavior)
    const existingReaction = await this.prisma.postReaction.findUnique({
      where: {
        postId_userId_emoji: { postId, userId, emoji },
      },
    });

    if (existingReaction) {
      // Remove existing reaction (toggle off)
      await this.prisma.postReaction.delete({
        where: { id: existingReaction.id },
      });

      this.logger.log(`Reaction removed: ${emoji} from post ${postId} by user ${userId}`);
    } else {
      // Add new reaction
      await this.prisma.postReaction.create({
        data: {
          postId,
          userId,
          emoji,
        },
      });

      this.logger.log(`Reaction added: ${emoji} to post ${postId} by user ${userId}`);
    }

    // Get updated reaction counts
    const reactions = await this.prisma.postReaction.findMany({
      where: { postId },
    });

    const reactionCounts: Record<string, number> = {};
    reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
    });

    return {
      success: true,
      data: {
        postId,
        emoji,
        action: existingReaction ? "removed" : "added",
        totalReactions: reactionCounts,
      },
    };
  }

  /**
   * Remove reaction from a post
   */
  async removeReaction(userId: string, postId: string, emoji: string) {
    // Verify post exists
    const post = await this.prisma.channelPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify user has access to the channel
    const hasAccess = await this.checkChannelAccess(userId, post.channelId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this channel");
    }

    // Find and delete the reaction
    const reaction = await this.prisma.postReaction.findUnique({
      where: {
        postId_userId_emoji: { postId, userId, emoji },
      },
    });

    if (!reaction) {
      throw new NotFoundException("Reaction not found");
    }

    await this.prisma.postReaction.delete({
      where: { id: reaction.id },
    });

    this.logger.log(`Reaction removed: ${emoji} from post ${postId} by user ${userId}`);

    // Get updated reaction counts
    const reactions = await this.prisma.postReaction.findMany({
      where: { postId },
    });

    const reactionCounts: Record<string, number> = {};
    reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
    });

    return {
      success: true,
      data: {
        postId,
        emoji,
        totalReactions: reactionCounts,
      },
    };
  }

  /**
   * Get all reactions for a post
   */
  async getPostReactions(userId: string, postId: string) {
    // Verify post exists
    const post = await this.prisma.channelPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify user has access to the channel
    const hasAccess = await this.checkChannelAccess(userId, post.channelId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this channel");
    }

    const reactions = await this.prisma.postReaction.findMany({
      where: { postId },
    });

    // Group by emoji
    const reactionsByEmoji: Record<string, string[]> = {};
    const reactionCounts: Record<string, number> = {};
    let userReaction: string | null = null;

    reactions.forEach((r) => {
      if (!reactionsByEmoji[r.emoji]) {
        reactionsByEmoji[r.emoji] = [];
      }
      reactionsByEmoji[r.emoji].push(r.userId);
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;

      if (r.userId === userId) {
        userReaction = r.emoji;
      }
    });

    return {
      success: true,
      data: {
        postId,
        reactions: reactionsByEmoji,
        counts: reactionCounts,
        total: reactions.length,
        userReaction,
      },
    };
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Create a new post (Admin only)
   */
  async createPost(
    adminId: string,
    channelId: string,
    createPostDto: CreatePostDto
  ) {
    // Verify channel exists
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    const post = await this.prisma.channelPost.create({
      data: {
        channelId,
        content: createPostDto.content,
        type: (createPostDto.type as any) || "ANNOUNCEMENT",
        attachments: createPostDto.attachments
          ? JSON.parse(JSON.stringify(createPostDto.attachments))
          : null,
        meetingLink: createPostDto.meetingLink,
        eventTime: createPostDto.eventTime
          ? new Date(createPostDto.eventTime)
          : null,
        isPinned: createPostDto.isPinned || false,
        postedBy: adminId,
      },
    });

    // Update channel's updatedAt timestamp
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Post created: ${post.id} in channel ${channelId} by admin ${adminId}`);

    return {
      success: true,
      post,
    };
  }

  /**
   * Update an existing post (Admin only)
   */
  async updatePost(
    adminId: string,
    channelId: string,
    postId: string,
    updatePostDto: UpdatePostDto
  ) {
    // Verify post exists and belongs to the channel
    const post = await this.prisma.channelPost.findFirst({
      where: {
        id: postId,
        channelId,
      },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    const updatedPost = await this.prisma.channelPost.update({
      where: { id: postId },
      data: {
        ...(updatePostDto.content && { content: updatePostDto.content }),
        ...(updatePostDto.type && { type: updatePostDto.type as any }),
        ...(updatePostDto.attachments !== undefined && {
          attachments: updatePostDto.attachments
            ? JSON.parse(JSON.stringify(updatePostDto.attachments))
            : null,
        }),
        ...(updatePostDto.meetingLink !== undefined && {
          meetingLink: updatePostDto.meetingLink,
        }),
        ...(updatePostDto.eventTime !== undefined && {
          eventTime: updatePostDto.eventTime
            ? new Date(updatePostDto.eventTime)
            : null,
        }),
        ...(updatePostDto.isPinned !== undefined && {
          isPinned: updatePostDto.isPinned,
        }),
      },
    });

    this.logger.log(`Post updated: ${postId} by admin ${adminId}`);

    return {
      success: true,
      post: updatedPost,
    };
  }

  /**
   * Delete a post (Admin only)
   */
  async deletePost(adminId: string, channelId: string, postId: string) {
    // Verify post exists and belongs to the channel
    const post = await this.prisma.channelPost.findFirst({
      where: {
        id: postId,
        channelId,
      },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    await this.prisma.channelPost.delete({
      where: { id: postId },
    });

    this.logger.log(`Post deleted: ${postId} by admin ${adminId}`);

    return {
      success: true,
      message: "Post deleted successfully",
    };
  }

  /**
   * Toggle pin status of a post (Admin only)
   */
  async togglePinPost(adminId: string, channelId: string, postId: string) {
    // Verify post exists and belongs to the channel
    const post = await this.prisma.channelPost.findFirst({
      where: {
        id: postId,
        channelId,
      },
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    const updatedPost = await this.prisma.channelPost.update({
      where: { id: postId },
      data: {
        isPinned: !post.isPinned,
      },
    });

    this.logger.log(
      `Post ${postId} pin status toggled to ${updatedPost.isPinned} by admin ${adminId}`
    );

    return {
      success: true,
      post: updatedPost,
    };
  }
}
