import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding courses, consultancy services, and channels...\n");

  // Get an admin user ID (first user in the system) for posting
  const adminUser = await prisma.user.findFirst();
  if (!adminUser) {
    console.error("❌ No users found in database. Please create at least one user first.");
    process.exit(1);
  }
  const adminId = adminUser.id;
  console.log(`Using admin user: ${adminUser.email} (${adminId})\n`);

  // ============================================
  // COURSES
  // ============================================
  console.log("📚 Creating courses...");

  const course1 = await prisma.course.create({
    data: {
      title: "Stock Trading Masterclass",
      description: "A comprehensive bootcamp covering everything from market basics to advanced trading strategies. Learn technical analysis, risk management, and develop your own trading system.",
      type: "BOOTCAMP",
      category: "Stock Trading Basics",
      duration: 30,
      price: 9999,
      startDate: new Date("2025-03-01"),
      thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
      instructor: "Rajesh Kumar",
      syllabus: JSON.stringify([
        "Introduction to Stock Markets",
        "Understanding Market Participants",
        "Reading Stock Charts",
        "Technical Indicators",
        "Risk Management Basics",
        "Building a Trading Plan",
        "Paper Trading Practice",
        "Live Trading Session"
      ]),
      metadata: {
        instructorBio: "15+ years experience in equity markets. Former analyst at HDFC Securities.",
        instructorImage: "https://randomuser.me/api/portraits/men/32.jpg"
      },
      isActive: true,
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: "Technical Analysis Pro",
      description: "Master chart patterns, candlestick formations, and technical indicators. This course will transform you into a confident technical trader.",
      type: "COURSE",
      category: "Technical Analysis",
      duration: 45,
      price: 14999,
      thumbnail: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800",
      instructor: "Priya Sharma",
      syllabus: JSON.stringify([
        "Candlestick Patterns Deep Dive",
        "Support & Resistance Mastery",
        "Moving Averages Strategy",
        "RSI & MACD Trading",
        "Fibonacci Retracements",
        "Volume Analysis",
        "Chart Pattern Recognition",
        "Multi-Timeframe Analysis",
        "Building Trading Systems"
      ]),
      metadata: {
        instructorBio: "CMT certified analyst with 10+ years in technical research.",
        instructorImage: "https://randomuser.me/api/portraits/women/44.jpg"
      },
      isActive: true,
    },
  });

  const course3 = await prisma.course.create({
    data: {
      title: "Options Trading Workshop",
      description: "An intensive 2-day workshop on options trading. Learn options Greeks, strategies like Iron Condor, Straddles, and how to hedge your portfolio.",
      type: "WORKSHOP",
      category: "Options Trading",
      duration: 2,
      price: 4999,
      startDate: new Date("2025-02-22"),
      thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
      instructor: "Amit Patel",
      syllabus: JSON.stringify([
        "Options Basics & Terminology",
        "Understanding Greeks",
        "Call & Put Strategies",
        "Spreads & Combinations",
        "Live Options Chain Analysis"
      ]),
      metadata: {
        instructorBio: "Options specialist with expertise in derivatives trading.",
        instructorImage: "https://randomuser.me/api/portraits/men/67.jpg"
      },
      isActive: true,
    },
  });

  const course4 = await prisma.course.create({
    data: {
      title: "Intraday Trading Secrets",
      description: "Learn the art of day trading with proven strategies. Covers scalping, momentum trading, and managing trades in volatile markets.",
      type: "BOOTCAMP",
      category: "Intraday Trading",
      duration: 21,
      price: 7999,
      startDate: new Date("2025-03-15"),
      thumbnail: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800",
      instructor: "Vikram Singh",
      syllabus: JSON.stringify([
        "Intraday Market Psychology",
        "Pre-Market Analysis",
        "Scalping Techniques",
        "Momentum Trading",
        "Gap Trading Strategies",
        "Order Flow Analysis",
        "Position Sizing",
        "Trade Management"
      ]),
      metadata: {
        instructorBio: "Full-time day trader with consistent profits for 8+ years.",
        instructorImage: "https://randomuser.me/api/portraits/men/52.jpg"
      },
      isActive: true,
    },
  });

  const course5 = await prisma.course.create({
    data: {
      title: "Fundamental Analysis Mastery",
      description: "Learn to analyze companies like Warren Buffett. Understand financial statements, valuation methods, and identify multibagger stocks.",
      type: "COURSE",
      category: "Fundamental Analysis",
      duration: 60,
      price: 12999,
      thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
      instructor: "Deepak Mehta",
      syllabus: JSON.stringify([
        "Reading Annual Reports",
        "Income Statement Analysis",
        "Balance Sheet Deep Dive",
        "Cash Flow Analysis",
        "Ratio Analysis",
        "Valuation Methods (PE, PB, DCF)",
        "Identifying Moats",
        "Sector Analysis",
        "Building a Value Portfolio"
      ]),
      metadata: {
        instructorBio: "CA & CFA with 20 years in equity research and fund management.",
        instructorImage: "https://randomuser.me/api/portraits/men/45.jpg"
      },
      isActive: true,
    },
  });

  console.log(`✅ Created ${5} courses\n`);

  // ============================================
  // CONSULTANCY SERVICES
  // ============================================
  console.log("💼 Creating consultancy services...");

  const service1 = await prisma.consultancyService.create({
    data: {
      name: "Premium Stock Advisory",
      description: "Get daily stock recommendations with entry, exit, and stop-loss levels. Our research team provides thoroughly analyzed picks.",
      type: "SUBSCRIPTION",
      price: 2999,
      duration: 30,
      features: [
        "2-3 stock picks daily",
        "Entry, target & stop-loss levels",
        "Real-time alerts via app",
        "Weekly market outlook",
        "Dedicated support"
      ],
      isActive: true,
    },
  });

  const service2 = await prisma.consultancyService.create({
    data: {
      name: "Intraday Calls",
      description: "High-accuracy intraday trading calls for active traders. Get timely entry and exit alerts for quick profits.",
      type: "SUBSCRIPTION",
      price: 4999,
      duration: 30,
      features: [
        "3-5 intraday calls daily",
        "Real-time entry/exit alerts",
        "Strict risk management",
        "70%+ accuracy rate",
        "Post-market analysis"
      ],
      isActive: true,
    },
  });

  const service3 = await prisma.consultancyService.create({
    data: {
      name: "Personal Consultation - 60 min",
      description: "One-on-one session with our expert analyst. Get personalized advice on your portfolio, trading strategy, or any market-related queries.",
      type: "SESSION",
      price: 1999,
      duration: 60,
      features: [
        "60-minute video call",
        "Portfolio review",
        "Personalized advice",
        "Strategy discussion",
        "Follow-up notes via email"
      ],
      isActive: true,
    },
  });

  const service4 = await prisma.consultancyService.create({
    data: {
      name: "Swing Trading Package",
      description: "Medium-term trading opportunities with 1-4 week holding period. Perfect for working professionals who can't trade daily.",
      type: "SUBSCRIPTION",
      price: 3499,
      duration: 30,
      features: [
        "5-8 swing trades per month",
        "Detailed research reports",
        "Entry zones & targets",
        "Weekly review calls",
        "Position tracking"
      ],
      isActive: true,
    },
  });

  const service5 = await prisma.consultancyService.create({
    data: {
      name: "Quick Consultation - 30 min",
      description: "A focused 30-minute session for specific queries. Ideal for quick portfolio checks or specific stock analysis.",
      type: "SESSION",
      price: 999,
      duration: 30,
      features: [
        "30-minute video call",
        "Focused discussion",
        "Quick portfolio check",
        "Specific stock analysis",
        "Actionable takeaways"
      ],
      isActive: true,
    },
  });

  console.log(`✅ Created ${5} consultancy services\n`);

  // ============================================
  // CHANNELS
  // ============================================
  console.log("📢 Creating channels...");

  // Channels for courses
  const channel1 = await prisma.channel.create({
    data: {
      name: "Stock Trading Masterclass",
      description: "Official channel for Stock Trading Masterclass students",
      type: "COURSE",
      courseId: course1.id,
      thumbnail: course1.thumbnail,
      isActive: true,
    },
  });

  const channel2 = await prisma.channel.create({
    data: {
      name: "Technical Analysis Pro",
      description: "Official channel for Technical Analysis Pro students",
      type: "COURSE",
      courseId: course2.id,
      thumbnail: course2.thumbnail,
      isActive: true,
    },
  });

  const channel3 = await prisma.channel.create({
    data: {
      name: "Options Trading Workshop",
      description: "Official channel for Options Workshop participants",
      type: "COURSE",
      courseId: course3.id,
      thumbnail: course3.thumbnail,
      isActive: true,
    },
  });

  const channel4 = await prisma.channel.create({
    data: {
      name: "Intraday Trading Secrets",
      description: "Official channel for Intraday Trading bootcamp",
      type: "COURSE",
      courseId: course4.id,
      thumbnail: course4.thumbnail,
      isActive: true,
    },
  });

  const channel5 = await prisma.channel.create({
    data: {
      name: "Fundamental Analysis Mastery",
      description: "Official channel for Fundamental Analysis course",
      type: "COURSE",
      courseId: course5.id,
      thumbnail: course5.thumbnail,
      isActive: true,
    },
  });

  // Channels for consultancy services
  const channel6 = await prisma.channel.create({
    data: {
      name: "Premium Stock Advisory",
      description: "Daily stock recommendations and market updates",
      type: "CONSULTANCY",
      serviceId: service1.id,
      isActive: true,
    },
  });

  const channel7 = await prisma.channel.create({
    data: {
      name: "Intraday Calls",
      description: "Real-time intraday trading alerts",
      type: "CONSULTANCY",
      serviceId: service2.id,
      isActive: true,
    },
  });

  const channel8 = await prisma.channel.create({
    data: {
      name: "Swing Trading Alerts",
      description: "Swing trading opportunities and updates",
      type: "CONSULTANCY",
      serviceId: service4.id,
      isActive: true,
    },
  });

  console.log(`✅ Created ${8} channels\n`);

  // ============================================
  // CHANNEL POSTS
  // ============================================
  console.log("📝 Creating channel posts...");

  // Posts for Stock Trading Masterclass (channel1)
  await prisma.channelPost.create({
    data: {
      channelId: channel1.id,
      type: "ANNOUNCEMENT",
      content: "# Welcome to Stock Trading Masterclass! 🎉\n\nWe're excited to have you here. This channel will be your go-to place for:\n\n- **Course announcements**\n- **Live session links**\n- **Additional resources**\n- **Q&A discussions**\n\nLet's begin this journey together!",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel1.id,
      type: "MEETING_LINK",
      content: "## Live Session: Introduction to Stock Markets\n\nJoin us for the first live session where we'll cover the basics of how stock markets work.\n\n**Topics:**\n- What is a stock?\n- How exchanges work\n- Types of orders\n- Trading hours",
      meetingLink: "https://zoom.us/j/1234567890",
      eventTime: new Date("2025-03-01T10:00:00"),
      postedBy: adminId,
      isPinned: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel1.id,
      type: "RESOURCE",
      content: "## 📚 Course Materials - Week 1\n\nDownload the presentation slides and practice worksheets for this week.\n\n**Included:**\n- Introduction to Markets (PDF)\n- Stock Screener Template (Excel)\n- Recommended Reading List",
      attachments: JSON.stringify([
        { type: "PDF", url: "https://example.com/week1-slides.pdf", name: "Week 1 Slides" },
        { type: "LINK", url: "https://example.com/screener", name: "Stock Screener" }
      ]),
      postedBy: adminId,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // Posts for Technical Analysis Pro (channel2)
  await prisma.channelPost.create({
    data: {
      channelId: channel2.id,
      type: "ANNOUNCEMENT",
      content: "# Welcome to Technical Analysis Pro! 📊\n\nThis channel is dedicated to mastering the art of reading charts. You'll receive:\n\n- Daily chart analysis\n- Pattern alerts\n- Live trading examples\n- Weekly webinars\n\nLet's decode the markets together!",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel2.id,
      type: "STOCK_TIP",
      content: "## 📈 Chart Analysis: RELIANCE\n\n**Pattern:** Bullish Flag Breakout\n\n- **Current Price:** ₹2,450\n- **Entry Zone:** ₹2,440-2,460\n- **Target 1:** ₹2,520\n- **Target 2:** ₹2,580\n- **Stop Loss:** ₹2,390\n\n**Risk-Reward:** 1:2.5\n\n*Educational purpose only. Do your own research.*",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // Posts for Premium Stock Advisory (channel6)
  await prisma.channelPost.create({
    data: {
      channelId: channel6.id,
      type: "ANNOUNCEMENT",
      content: "# Welcome to Premium Stock Advisory! 💎\n\nYou now have access to our premium research. Expect:\n\n- **2-3 quality picks daily**\n- **Real-time alerts**\n- **Weekly market outlook**\n- **Direct analyst support**\n\nAll calls come with proper risk management levels.",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel6.id,
      type: "STOCK_TIP",
      content: "## 🟢 BUY: TATA MOTORS\n\n**CMP:** ₹785\n\n| Level | Price |\n|-------|-------|\n| Entry | ₹780-790 |\n| Target 1 | ₹820 |\n| Target 2 | ₹850 |\n| Stop Loss | ₹755 |\n\n**Rationale:** Strong quarterly results, EV segment growth, positive technical setup with RSI support.\n\n**Risk:** Medium\n**Horizon:** 2-3 weeks",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel6.id,
      type: "STOCK_TIP",
      content: "## 🟢 BUY: HDFC BANK\n\n**CMP:** ₹1,650\n\n| Level | Price |\n|-------|-------|\n| Entry | ₹1,640-1,660 |\n| Target 1 | ₹1,720 |\n| Target 2 | ₹1,780 |\n| Stop Loss | ₹1,600 |\n\n**Rationale:** Banking sector strength, strong asset quality, support at key moving averages.\n\n**Risk:** Low\n**Horizon:** 3-4 weeks",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel6.id,
      type: "ANNOUNCEMENT",
      content: "## 📊 Weekly Market Outlook\n\n**Nifty 50:** Consolidating near 22,000. Breakout above 22,200 can take it to 22,500.\n\n**Key Events:**\n- RBI Policy (Thursday)\n- US Jobs Data (Friday)\n- Q3 Results Season\n\n**Sectors to Watch:**\n✅ Banking\n✅ Auto\n✅ IT (selective)\n\n**Avoid:** Metals, Real Estate\n\nStay disciplined with stop losses!",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // Posts for Intraday Calls (channel7)
  await prisma.channelPost.create({
    data: {
      channelId: channel7.id,
      type: "ANNOUNCEMENT",
      content: "# Welcome to Intraday Calls! ⚡\n\n**Trading Hours:** 9:15 AM - 3:30 PM\n\n**Rules to Follow:**\n1. Never risk more than 1% per trade\n2. Exit all positions before market close\n3. Follow stop losses strictly\n4. Don't average losing positions\n\nAll calls are for educational purposes. Trade at your own risk.",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel7.id,
      type: "STOCK_TIP",
      content: "## ⚡ INTRADAY BUY: NIFTY 22000 CE\n\n**Entry:** ₹180-185\n**Target 1:** ₹210\n**Target 2:** ₹240\n**Stop Loss:** ₹160\n\n**Logic:** Nifty showing strength above 21950. Expecting move towards 22100.\n\n⏰ *Valid for today only*",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel7.id,
      type: "STOCK_TIP",
      content: "## ⚡ INTRADAY BUY: ICICI BANK\n\n**Entry:** ₹1,085-1,090\n**Target:** ₹1,105\n**Stop Loss:** ₹1,075\n\n**Logic:** Breaking out of morning range with good volumes.\n\n⏰ *Valid for today only*",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  // Posts for Swing Trading Alerts (channel8)
  await prisma.channelPost.create({
    data: {
      channelId: channel8.id,
      type: "ANNOUNCEMENT",
      content: "# Welcome to Swing Trading Alerts! 📈\n\nSwing trading is perfect for those who can't monitor markets all day.\n\n**Our Approach:**\n- Hold for 1-4 weeks\n- Ride the trend\n- Strict risk management\n- Quality over quantity\n\nExpect 5-8 high-conviction picks per month.",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel8.id,
      type: "STOCK_TIP",
      content: "## 📈 SWING TRADE: INFOSYS\n\n**CMP:** ₹1,580\n\n| Level | Price |\n|-------|-------|\n| Entry | ₹1,560-1,590 |\n| Target 1 | ₹1,680 |\n| Target 2 | ₹1,750 |\n| Stop Loss | ₹1,500 |\n\n**Thesis:** IT sector showing relative strength. Infosys at support with positive divergence on RSI. Dollar weakness supporting IT stocks.\n\n**Holding Period:** 2-4 weeks\n**Risk:** Medium",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel8.id,
      type: "ANNOUNCEMENT",
      content: "## ✅ TRADE CLOSED: BHARTI AIRTEL\n\n**Entry:** ₹1,420\n**Exit:** ₹1,520\n**Return:** +7%\n**Duration:** 12 days\n\nTarget 1 achieved! Congratulations to all who followed. 🎉\n\nBooking profits and moving to next opportunity.",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // Posts for Options Workshop (channel3)
  await prisma.channelPost.create({
    data: {
      channelId: channel3.id,
      type: "ANNOUNCEMENT",
      content: "# Options Trading Workshop 📋\n\nWelcome to the intensive 2-day options workshop!\n\n**Day 1:** Options basics, Greeks, and single-leg strategies\n**Day 2:** Advanced strategies and live trading\n\nMake sure to have your trading terminal ready for live practice sessions.",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel3.id,
      type: "MEETING_LINK",
      content: "## Day 1 Live Session\n\n**Time:** 10:00 AM - 5:00 PM\n**Topics:** Options Basics & Greeks\n\nPlease join 10 minutes early to test your connection.",
      meetingLink: "https://zoom.us/j/9876543210",
      eventTime: new Date("2025-02-22T10:00:00"),
      postedBy: adminId,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  // Posts for Fundamental Analysis (channel5)
  await prisma.channelPost.create({
    data: {
      channelId: channel5.id,
      type: "ANNOUNCEMENT",
      content: "# Fundamental Analysis Mastery 📊\n\nWelcome value investors!\n\nThis course will teach you to think like Warren Buffett and analyze companies like a pro.\n\n**Key Focus Areas:**\n- Financial statement analysis\n- Valuation techniques\n- Identifying competitive moats\n- Long-term wealth creation",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel5.id,
      type: "RESOURCE",
      content: "## 📚 Essential Reading Material\n\nBefore we dive deep, here are some foundational resources:\n\n1. **The Intelligent Investor** - Benjamin Graham\n2. **One Up On Wall Street** - Peter Lynch\n3. **Warren Buffett's Letters to Shareholders**\n\nAlso, familiarize yourself with Screener.in for company data.",
      postedBy: adminId,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });

  // Posts for Intraday Trading Secrets (channel4)
  await prisma.channelPost.create({
    data: {
      channelId: channel4.id,
      type: "ANNOUNCEMENT",
      content: "# Intraday Trading Secrets Bootcamp 🔥\n\nWelcome to the most intensive day trading program!\n\n**What to Expect:**\n- Daily pre-market analysis\n- Live trading sessions\n- Real-time trade calls\n- End-of-day reviews\n\nRemember: Discipline is the key to successful trading!",
      postedBy: adminId,
      isPinned: true,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.channelPost.create({
    data: {
      channelId: channel4.id,
      type: "MEETING_LINK",
      content: "## Pre-Market Analysis Session\n\n**Daily at 8:45 AM**\n\nWe'll cover:\n- Gap analysis\n- Key levels for the day\n- Stocks to watch\n- Global cues\n\nJoin consistently for best results!",
      meetingLink: "https://zoom.us/j/5555555555",
      eventTime: new Date("2025-03-15T08:45:00"),
      postedBy: adminId,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Created channel posts\n");

  // ============================================
  // SUMMARY
  // ============================================
  console.log("🎉 Seeding completed successfully!\n");
  console.log("📊 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📚 Courses: 5");
  console.log("   - Stock Trading Masterclass (Bootcamp)");
  console.log("   - Technical Analysis Pro (Course)");
  console.log("   - Options Trading Workshop (Workshop)");
  console.log("   - Intraday Trading Secrets (Bootcamp)");
  console.log("   - Fundamental Analysis Mastery (Course)");
  console.log("");
  console.log("💼 Consultancy Services: 5");
  console.log("   - Premium Stock Advisory (Subscription - ₹2,999/month)");
  console.log("   - Intraday Calls (Subscription - ₹4,999/month)");
  console.log("   - Personal Consultation 60 min (Session - ₹1,999)");
  console.log("   - Swing Trading Package (Subscription - ₹3,499/month)");
  console.log("   - Quick Consultation 30 min (Session - ₹999)");
  console.log("");
  console.log("📢 Channels: 8 (5 course + 3 consultancy)");
  console.log("📝 Channel Posts: Multiple per channel");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
