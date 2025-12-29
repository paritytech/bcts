export default defineAppConfig({
  ui: {
    colors: {
      primary: "pink", // Main brand color (Polkadot pink)
      secondary: "violet", // Secondary actions
      success: "green", // Success states
      info: "sky", // Info messages
      warning: "amber", // Warning states
      error: "red", // Error states
      neutral: "slate", // Text, borders, backgrounds
    },
    button: {
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class: "text-white",
        },
      ],
    },
    tabs: {
      compoundVariants: [
        {
          color: "primary",
          variant: "pill",
          class: {
            trigger: "data-[state=active]:text-white",
          },
        },
      ],
    },
    dashboardToolbar: {
      slots: {
        root: "shrink-0 flex items-stretch justify-between border-b border-default !px-0 gap-0 overflow-x-auto min-h-[49px]",
        left: "flex items-stretch gap-0 !ml-0 flex-1",
        right: "flex items-stretch gap-0 !mr-0 flex-1 justify-end",
      },
    },
    dashboardPanel: {
      slots: {
        body: "flex flex-col flex-1 overflow-y-auto !p-0 !gap-0",
      },
    },
    navigationMenu: {
      compoundVariants: [
        {
          orientation: "vertical",
          active: true,
          class: {
            link: "bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-300",
          },
        },
      ],
    },
  },
});
