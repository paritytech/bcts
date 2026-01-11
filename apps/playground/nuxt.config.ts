// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-09-11",
  modules: ["@nuxt/eslint", "@nuxt/ui", "@nuxthub/core", "@nuxtjs/seo"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
      meta: [{ name: "theme-color", content: "#FF2670" }],
    },
  },
  site: {
    url: "https://bcts.dev",
    name: "BCTS IDE - Blockchain Commons TypeScript",
    description:
      "Interactive playground for exploring dCBOR encoding, Uniform Resources, and Gordian Envelope visualization. Parse, encode, and convert between formats with live examples.",
    defaultLocale: "en",
  },
  sitemap: {
    urls: [
      // Package documentation
      "https://docs.bcts.dev/api/components",
      "https://docs.bcts.dev/api/crypto",
      "https://docs.bcts.dev/api/dcbor",
      "https://docs.bcts.dev/api/dcbor-parse",
      "https://docs.bcts.dev/api/dcbor-pattern",
      "https://docs.bcts.dev/api/envelope",
      "https://docs.bcts.dev/api/envelope-pattern",
      "https://docs.bcts.dev/api/gstp",
      "https://docs.bcts.dev/api/known-values",
      "https://docs.bcts.dev/api/provenance-mark",
      "https://docs.bcts.dev/api/rand",
      "https://docs.bcts.dev/api/shamir",
      "https://docs.bcts.dev/api/sskr",
      "https://docs.bcts.dev/api/tags",
      "https://docs.bcts.dev/api/uniform-resources",
      "https://docs.bcts.dev/api/xid",
      // CLI Tools documentation
      "https://docs.bcts.dev/api/dcbor-cli",
      "https://docs.bcts.dev/api/envelope-cli",
      "https://docs.bcts.dev/api/provenance-mark-cli",
      "https://docs.bcts.dev/api/seedtool-cli",
    ],
  },
  routeRules: {
    "/": { prerender: true },
  },
  hub: {
    kv: true,
  },
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
    storage: {
      cache: {
        driver: "cloudflare-kv-binding",
        binding: "CACHE",
      },
    },
  },
});
