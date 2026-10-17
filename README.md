# ShadsTech Chat

A WhatsApp-style realtime chat app built with vanilla HTML, CSS and JavaScript,
powered by Supabase (auth, Postgres, realtime) and hosted on GitHub Pages.

## Features
- Email / password authentication
- Username profiles
- One-on-one realtime messaging
- Contact search
- Responsive layout

## Stack
- HTML + CSS + vanilla JS (ES modules)
- Supabase JS v2 (via ESM CDN)
- Supabase Postgres + Realtime + RLS

## Setup
1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the SQL Editor.
3. Put your project URL + anon key in `js/config.js`.
4. Push to GitHub and enable Pages (branch: `main`, folder: `/root`).

## Security
All tables use Row Level Security — users can only read messages they
sent or received. Never commit a `service_role` key.