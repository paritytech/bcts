export default defineAppConfig({
  ui: {
    dashboardNavbar: {
      slots: {
        root: 'h-(--ui-header-height) shrink-0 flex items-center justify-between border-b border-default pl-1 pr-4 gap-1',
        left: 'flex items-center gap-1 min-w-0',
        title: 'flex items-center gap-1 font-semibold text-highlighted truncate'
      }
    }
  }
})
