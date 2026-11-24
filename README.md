# Ideabro Academy

A learning portal where people get access to what they bought from you — courses, live
workshops, AI agents, automation workflows and other digital products — plus a full admin
panel for managing everything students see.

There are **no payments in this app**. People buy on your other platforms; this portal is
told who bought what (by you, by a CSV import, or automatically through the API) and gives
them access.

## What's inside

**Student portal**

- Sign in with a password or a one-time email code; accounts are created automatically when access is granted
- Home screen with "continue where you left off", progress, learning streak, upcoming live sessions and announcements
- Library of everything the student owns, filterable by type
- Course player: video (YouTube, Vimeo, Bunny, uploads, direct links, HLS), articles, quizzes, downloads and embeds; resume position, mark complete, private notes
- Drip schedules (sections that unlock N days after joining) and optional lesson-by-lesson ordering
- Workshops: session times in the student's own time zone, join button, add-to-calendar, replays
- Agents / workflows / digital products: setup guide, files, links, copyable snippets, version updates, licence keys
- Bundles that unlock every product inside them
- Certificates issued automatically on completion, each with a public verification link
- Works on phones (bottom tab bar), tablets and laptops, in light and dark themes

**Admin panel** (`/admin`)

- Dashboard with students, access grants and learning activity
- Products of six types (course, workshop, AI agent, workflow, digital product, bundle) with a content builder: sections, lessons, quizzes, live sessions, files & links, changelog
- Students: search, profile, grant / revoke / extend access, reset progress, view the portal as a student
- Access: grant to any email (creates the account and emails a sign-in link), bulk CSV import
- Announcements, content pages (About, Terms, Privacy…)
- Settings that restyle and re-word the site: name, logo, brand colours, home page, navigation, sign-in rules, certificates, email, SEO
- Integrations: API keys and a guide for connecting other platforms
- Team roles: owner, admin, instructor, support

**Granting access from another platform**

Create a key in **Admin → Integrations**, then call the API from your payment tool, Zapier,
Make, n8n, Pabbly or your own code:

```bash
curl -X POST "$APP_URL/api/v1/enrollments" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","name":"Buyer Name","product":"your-product-slug-or-sku","reference":"order-123"}'
```

- `product` accepts the product's slug, its SKU / external ID (set under **Product → Access**) or its id; `products` takes a list
- The account is created if the email is new, and the buyer is emailed a one-click sign-in link (`"send_email": false` to skip)
- Safe to retry: the same person + product (or the same `reference`) is never granted twice
- `expires_at` (ISO date) sets an end date; otherwise the product's own access length applies
- `DELETE /api/v1/enrollments` with `{"email","product"}` removes access (for refunds)
- `GET /api/v1/products` lists products with their slugs and SKUs
- Tools that can't send headers may pass the key as `?api_key=YOUR_KEY`

## Run it locally

Requirements: Node.js 22+, PostgreSQL 14+.

```bash
cp .env.example .env        # then fill in DATABASE_URL, APP_URL and APP_SECRET
npm install
npm run setup               # creates the tables, the owner account and sample content
npm run dev                 # http://localhost:3000
```

`npm run setup` prints the owner's password if you didn't set `SEED_ADMIN_PASSWORD`.
Sign in at `/login`; the admin panel is at `/admin`.

The sample content (six products, a handful of students at `@example.com`) is there so you can
see how everything looks. Remove it from **Admin → Dashboard → Remove sample content** before
you launch, or set `SEED_DEMO=false` before the first `npm run setup`.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Build and run for production |
| `npm run setup` | Apply database migrations and seed the owner + sample content |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` |
| `npm test` | Unit tests |
| `npm run typecheck` / `npm run lint` | Static checks |

## Put it online

The app is a standard Next.js server. It needs three things: a Node host, a PostgreSQL
database, and somewhere to keep uploaded files.

**Vercel (simplest)**

1. Create a PostgreSQL database (Neon, Supabase, or any other) and copy its connection string.
2. Import this repository into Vercel.
3. Add the environment variables from `.env.example`: `DATABASE_URL`, `APP_URL` (your domain), `APP_SECRET`, and the `S3_*` settings — Vercel has no persistent disk, so uploads need an S3-compatible bucket such as Cloudflare R2.
4. Set the build command to `prisma migrate deploy && next build`.
5. After the first deploy run the seed once from your machine with the production `DATABASE_URL`: `npm run db:seed`.

**A VPS**

Install Node 22 and PostgreSQL, clone the repo, create `.env`, then
`npm ci && npm run setup && npm run build && npm start` behind a reverse proxy (Caddy or
nginx) that provides HTTPS. Uploaded files are stored in `./storage` — keep that folder on a
persistent disk and include it in backups.

**Email**

Until an email provider is configured, emails (sign-in codes, access emails) are only written
to the server log and the database. Set up SMTP or Resend in **Admin → Settings → Email**
(or through the environment variables) before inviting real students.

## How it is built

- **Next.js 16** (App Router, React 19, TypeScript), **Tailwind CSS 4**, Radix UI primitives
- **PostgreSQL** with **Prisma 7**
- Sessions are database-backed, cookie-based; passwords are hashed with scrypt
- Files go to local disk or any S3-compatible bucket; private files are only served to people who have access to the product that uses them

```
prisma/               database schema, migration and seed
src/app/(site)        public pages: home, catalog, product pages, content pages
src/app/(auth)        sign in, sign up, password reset, invitations
src/app/(portal)      the student portal
src/app/(player)      the lesson player
src/app/(admin)       the admin panel
src/app/api/v1        the access API
src/server            server-side logic (auth, access, progress, email, storage…)
src/components        UI kit and feature components
src/lib               shared helpers and settings definitions
tests/unit            unit tests
```

## Not included (yet)

Payments and checkout (by design), student discussions, product reviews, assignment
submissions with grading, support tickets, scheduled reminder emails and outgoing webhooks.
The database schema already has tables for these, so they can be added without restructuring.
