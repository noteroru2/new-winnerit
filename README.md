# Winner IT — Headless WordPress + Astro

เว็บไซต์ **Winner IT** (winnerit.in.th) สร้างด้วย [Astro](https://astro.build) โดยดึงคอนเทนต์จาก WordPress REST API ที่ `wp.winnerit.in.th` แล้ว generate เป็น Static HTML ที่โหลดเร็วและเป็นมิตรกับ SEO

## Features

- **Headless WordPress** — ดึงบทความผ่าน REST API แล้ว build เป็น static pages
- **Auto Keyword Links** — ลิงก์คีย์เวิร์ดอัตโนมัติตาม `keyword-links.json`
- **Auto Image Alt** — เติม alt text ให้รูปที่ไม่มีอัตโนมัติตอน build
- **Sitemap + RSS** — สร้าง sitemap และ RSS feed อัตโนมัติ
- **Open Graph / Twitter Cards** — meta tags สำหรับ social sharing
- **Responsive** — รองรับทุกขนาดหน้าจอ พร้อม mobile hamburger menu

## Project Structure

```
src/
├── components/
│   ├── blog/           # PostCard, Post
│   └── site/           # Header, Footer
├── config/
│   └── keyword-links.json
├── layouts/
│   └── Layout.astro
├── lib/
│   ├── wp.ts           # WordPress API client
│   └── contentTransforms.ts
├── pages/
│   ├── index.astro
│   ├── [slug].astro    # Dynamic blog post routes
│   ├── articles/       # Blog listing with pagination
│   ├── buy-*.astro     # Buy-back service pages
│   ├── about.astro
│   ├── contact.astro
│   ├── 404.astro
│   └── rss.xml.js
└── styles/
    └── global.css
```

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start dev server at `localhost:4321`         |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview production build locally             |

## Environment Variables (Coolify / Deploy)

- `PUBLIC_SITE_URL` (recommended): Base URL used for canonical URLs + sitemap.
  - Example: `https://winnerit.in.th`
- `WP_BASE_URL` (recommended): WordPress base URL used during build to fetch posts.
  - Example: `https://wp.winnerit.in.th`
