import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MODE Student Organization",
    short_name: "MODE",
    description: "A student organization workspace for members, events, tasks, and treasury.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf5",
    theme_color: "#cc785c",
    icons: [
      { src: "/mode-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/mode-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
