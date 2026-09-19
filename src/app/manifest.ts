import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PostCrisp — AI Social Media Copilot",
    short_name: "PostCrisp",
    description: "Generate viral captions, find trending hashtags, and discover the best times to post.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E1216",
    theme_color: "#4A9EE0",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
