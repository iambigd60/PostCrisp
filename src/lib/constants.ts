// Platform options
import type { IconType } from "react-icons";
import { SiInstagram, SiX, SiTiktok, SiFacebook, SiYoutube, SiThreads } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";

export type PlatformId = "instagram" | "x" | "linkedin" | "tiktok" | "facebook" | "youtube" | "threads";

export type PlatformDef = {
  id: PlatformId;
  label: string;
  icon: IconType;
  color: string;
};

export const PLATFORMS: readonly PlatformDef[] = [
  { id: "instagram", label: "Instagram", icon: SiInstagram, color: "#E4405F" },
  { id: "tiktok",    label: "TikTok",    icon: SiTiktok,    color: "#EE1D52" },
  { id: "youtube",   label: "YouTube",   icon: SiYoutube,   color: "#FF0000" },
  { id: "x",         label: "X",         icon: SiX,         color: "#ffffff" },
  { id: "facebook",  label: "Facebook",  icon: SiFacebook,  color: "#1877F2" },
  { id: "threads",   label: "Threads",   icon: SiThreads,   color: "#ffffff" },
  { id: "linkedin",  label: "LinkedIn",  icon: FaLinkedin,  color: "#0A66C2" },
] as const;

// Platform character limits — { optimal: sweet spot, max: hard cap }
export const PLATFORM_LIMITS: Record<PlatformId, { optimal: number; max: number }> = {
  instagram: { optimal: 150,  max: 2200 },
  tiktok:    { optimal: 100,  max: 4000 },
  youtube:   { optimal: 300,  max: 5000 },
  x:         { optimal: 280,  max: 280 },
  facebook:  { optimal: 80,   max: 63206 },
  threads:   { optimal: 300,  max: 500 },
  linkedin:  { optimal: 200,  max: 3000 },
};

// Content type options for caption generator
export type ContentTypeId = "post" | "reel-hook" | "story" | "thread-opener" | "script-hook";

export const CONTENT_TYPES: readonly { id: ContentTypeId; label: string; icon: string }[] = [
  { id: "post",          label: "Post Caption",     icon: "📝" },
  { id: "reel-hook",     label: "Reel/Short Hook",  icon: "🎬" },
  { id: "story",         label: "Story Caption",    icon: "📸" },
  { id: "thread-opener", label: "Thread Opener",    icon: "🧵" },
  { id: "script-hook",   label: "Video Script Hook",icon: "🎤" },
] as const;

// Content type options for Best Times
export const BEST_TIME_CONTENT_TYPES = [
  { id: "post",      label: "Post" },
  { id: "reel",      label: "Reel / Short" },
  { id: "story",     label: "Story" },
  { id: "carousel",  label: "Carousel" },
  { id: "live",      label: "Live" },
  { id: "longform",  label: "Long-form Video" },
] as const;

// Audience regions for Best Times
export const AUDIENCE_REGIONS = [
  { id: "north-america",  label: "North America" },
  { id: "europe",         label: "Europe" },
  { id: "asia-pacific",   label: "Asia-Pacific" },
  { id: "latin-america",  label: "Latin America" },
  { id: "global",         label: "Global" },
] as const;

// Content formats for Viral Ideas / Script Generator / Repurposer
export const VIRAL_FORMATS = [
  "Short / Reel / TikTok",
  "Long Video",
  "Carousel",
  "Photo / Image",
  "Text Post",
  "Story",
  "Live",
  "Thread",
  "Podcast / Audio",
  "Infographic",
  "Meme / Reaction",
] as const;

// Content angles for Viral Ideas
export const VIRAL_ANGLES = [
  "Current Trends",
  "Evergreen",
  "Seasonal / Holiday",
  "Educational / How-to",
  "Behind-the-Scenes",
  "Controversial / Hot Takes",
  "Humor / Comedy",
  "Storytelling / Personal",
  "Tips / Hacks",
  "Listicle / Top X",
  "Case Study / Results",
  "Challenge / Trend-jacking",
  "Myth-busting / Debunking",
  "Inspirational / Motivational",
  "Q&A / AMA",
] as const;

// Industry / niche options — used across best-times, viral-ideas, etc.
export const NICHES = [
  { id: "general",            label: "General / Other" },
  { id: "fitness",            label: "Fitness & Health" },
  { id: "food",               label: "Food & Cooking" },
  { id: "travel",             label: "Travel" },
  { id: "fashion",            label: "Fashion & Beauty" },
  { id: "finance",            label: "Personal Finance" },
  { id: "tech",               label: "Tech & Gadgets" },
  { id: "business",           label: "Business & Entrepreneurship" },
  { id: "marketing",          label: "Marketing & Social Media" },
  { id: "education",          label: "Education & How-to" },
  { id: "parenting",          label: "Parenting & Family" },
  { id: "lifestyle",          label: "Lifestyle & Vlogs" },
  { id: "gaming",             label: "Gaming" },
  { id: "music",              label: "Music & Entertainment" },
  { id: "art",                label: "Art & Design" },
  { id: "comedy",             label: "Comedy & Humor" },
  { id: "sports",             label: "Sports" },
  { id: "news",               label: "News & Commentary" },
  { id: "motivation",         label: "Motivation & Self-improvement" },
  { id: "real-estate",        label: "Real Estate" },
  { id: "automotive",         label: "Automotive" },
  { id: "pets",               label: "Pets & Animals" },
  { id: "beauty",             label: "Beauty & Skincare" },
  { id: "diy",                label: "DIY & Crafts" },
  { id: "photography",        label: "Photography" },
] as const;

// Tone options
export const TONES = [
  { id: "casual",         label: "Casual",         icon: "😎" },
  { id: "professional",   label: "Professional",   icon: "👔" },
  { id: "humorous",       label: "Humorous",       icon: "😂" },
  { id: "inspirational",  label: "Inspirational",  icon: "✨" },
  { id: "educational",    label: "Educational",    icon: "📚" },
  { id: "controversial",  label: "Controversial",  icon: "🔥" },
  { id: "storytelling",   label: "Storytelling",   icon: "📖" },
] as const;

// Generation loading messages
export const GENERATION_MESSAGES = [
  "Crafting your captions...",
  "Finding the perfect words...",
  "Analyzing trending styles...",
  "Polishing your content...",
  "Adding that final sparkle...",
];

export const HASHTAG_MESSAGES = [
  "Finding trending hashtags...",
  "Analyzing hashtag performance...",
  "Curating the best tags...",
  "Checking engagement rates...",
];

export const BEST_TIME_MESSAGES = [
  "Analyzing peak times...",
  "Crunching engagement data...",
  "Finding your golden hours...",
  "Mapping audience activity...",
];

// Mock captions data
export const MOCK_CAPTIONS: Record<string, string[]> = {
  default: [
    "✨ Every day is a new opportunity to create something amazing. What are you building today? #motivation #create",
    "Behind every success story is a collection of failures that taught the real lessons. Keep going. 💪",
    "The best time to start was yesterday. The second best time is now. Let's make it happen! 🚀",
    "Your vibe attracts your tribe. Stay authentic, stay true. 🌟 #authenticity #growth",
  ],
  professional: [
    "Excited to announce our latest milestone! This achievement reflects our team's dedication to excellence and innovation. 🏆 #business #growth",
    "Three key insights from this quarter's data: 1) Consistency beats perfection 2) Engagement > reach 3) Authenticity always wins 📊",
    "Leadership isn't about being in charge. It's about taking care of those in your charge. #leadership #management",
  ],
  funny: [
    "My WiFi went down for 5 minutes, so I had to talk to my family. They seem like nice people. 😅 #relatable",
    "Me: I'll just check social media for 5 minutes. Also me: *emerges 3 hours later* What year is it? 📱",
    "Plot twist: The real influencer was the friends we made along the way 🤷‍♂️ #socialmedia #humor",
  ],
};

// Mock hashtags data
export const MOCK_HASHTAGS = [
  { tag: "#socialmedia", score: 98, posts: "45.2M" },
  { tag: "#marketing", score: 95, posts: "38.1M" },
  { tag: "#digitalmarketing", score: 92, posts: "29.7M" },
  { tag: "#contentcreator", score: 89, posts: "24.3M" },
  { tag: "#growthhacking", score: 85, posts: "18.9M" },
  { tag: "#branding", score: 83, posts: "15.6M" },
  { tag: "#entrepreneur", score: 80, posts: "42.1M" },
  { tag: "#startup", score: 78, posts: "21.4M" },
  { tag: "#business", score: 76, posts: "51.8M" },
  { tag: "#motivation", score: 74, posts: "35.2M" },
  { tag: "#success", score: 71, posts: "28.9M" },
  { tag: "#viral", score: 68, posts: "19.3M" },
  { tag: "#trending", score: 65, posts: "12.7M" },
  { tag: "#fyp", score: 96, posts: "67.4M" },
  { tag: "#reels", score: 88, posts: "33.5M" },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export type Platform = (typeof PLATFORMS)[number]["id"];
export type Tone = (typeof TONES)[number]["id"];

export interface SavedItem {
  id: string;
  // Open-string union — TYPE_META in saved/page.tsx renders known types with
  // proper badges + filter buttons; anything unknown falls back to a default
  // styling. Pages can save with any new type without schema changes.
  type: string;
  content: string;
  platform: string;
  createdAt: string;
}

export interface GenerationResult {
  captions: string[];
  platform: string;
  tone: string;
}

export interface HashtagResult {
  tag: string;
  score: number;
  posts: string;
}
