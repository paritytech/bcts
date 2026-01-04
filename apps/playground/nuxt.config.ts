// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-09-11",
  modules: ["@nuxt/eslint", "@nuxt/ui", "@nuxthub/core"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
      meta: [{ name: "theme-color", content: "#FF2670" }],
    },
  },
  routeRules: {
    "/": { prerender: true },
  },
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },
});
