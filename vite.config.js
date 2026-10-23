import { defineConfig } from "vite";
import portfolioAssets from "./build/asset-plugin.js";

export default defineConfig({
  // Keep large source kits out of publicDir; the plugin emits only the allowlist.
  publicDir: false,
  html: {
    additionalAssetSources: {
      a: {
        srcAttributes: ["href"],
        filter: ({ attributes }) => Object.hasOwn(attributes, "data-cv"),
      },
    },
  },
  plugins: [portfolioAssets()],
  build: {
    target: "es2020",
    outDir: "dist",
    cssCodeSplit: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "three", test: /[\\/]node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
});
