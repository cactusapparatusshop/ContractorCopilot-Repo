import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ContractorCopilot",
    short_name: "ContractorCopilot",
    description: "AI-powered proposals and estimates for specialty contractors.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#f45428",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
