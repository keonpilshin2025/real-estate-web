// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
// https://astro.build/config
export default defineConfig({
  site: 'https://central.ezbiztok.co.kr',
  output: 'static', // 기존 페이지는 정적 유지, /admin과 /api만 개별적으로 SSR
  adapter: cloudflare(),
  integrations: [
    sitemap(),
    icon(),
    react()
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
