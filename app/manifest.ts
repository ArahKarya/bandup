import type { MetadataRoute } from "next";

/** Installable app metadata. Colours match the light theme tokens (--bg, --accent). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BandUp — Open-source IELTS preparation",
    short_name: "BandUp",
    description: "Lessons, full mock tests, vocabulary and a progress tracker for IELTS Academic and General Training.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f7f5",
    theme_color: "#0f6e66",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
