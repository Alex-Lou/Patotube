import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Patotube landing — deployed to GitHub Pages.
// Repo: Alex-Lou/Patotube → site available at https://alex-lou.github.io/Patotube/
export default defineConfig({
  site: 'https://alex-lou.github.io',
  base: '/Patotube',
  trailingSlash: 'ignore',
  integrations: [tailwind({ applyBaseStyles: false })],
  build: {
    assets: '_assets',
  },
  server: {
    port: 4321,
    host: false,
  },
});
