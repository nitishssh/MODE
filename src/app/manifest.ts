import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MODE Student Organization",
    short_name: "MODE",
    description: "A student organization workspace for members, events, tasks, and treasury.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf5",
    theme_color: "#cc785c",
    icons: [
      { src: "/mode-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/mode-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/mode-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/mode-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
