import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Lunar IDE",
  description: "A real IDE for Roblox development",
  base: '/lunar-ide-angular/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/installation' }
    ],

    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Installation', link: '/installation' },
        ]
      },
      {
        text: 'Features',
        items: [
          { text: 'Runtime', link: '/features/runtime' },
          { text: 'State', link: '/features/state' },
          { text: 'TestEZ Runner', link: '/features/testez' },
          { text: 'Figma Import', link: '/features/figma' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Keyboard Shortcuts', link: '/keybindings' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/S7y1e/lunar-ide-angular' }
    ]
  }
})
