# PALM & TOEY · Wedding Gallery — Setup

Supabase project: **palm-toey-wedding** (ref `ebbnmgngfufrdjkkmhnx`, ap-southeast-1)
The database, RLS, and the `wedding-photos` bucket are already set up (migrations: wedding_gallery_init, wedding_harden_functions, wedding_stats_private_ref)

## Pages
| URL | For |
|---|---|
| `/wedding-gallery/` | Guests: home, upload, all photos (`#upload`, `#gallery`) |
| `/wedding-gallery/admin/` | Couple: dashboard, delete/hide photos, open/close uploads, QR |

## Create an Admin account (one time)
1. Supabase Dashboard → Authentication → Users → **Add user** → enter your email + password → turn on **Auto Confirm User**
2. SQL Editor → run:
   ```sql
   insert into public.wedding_admins (email) values (lower('your-email@example.com'));
   ```
3. Open `https://<your-domain>/wedding-gallery/admin/` and log in
4. (Recommended) Authentication → Sign In / Providers → turn off **Allow new users to sign up**

## Environment variables
None needed: this is a static site. The URL and the anon key in `assets/config.js` are public keys protected by RLS.
**Never put the `service_role` / secret key in any file in this repo.**

## Security (RLS summary)
- Guests: view photos with `status='approved'`, upload when `uploads_enabled = true`
- Storage: guests can upload only `photos|thumbs/YYYY-MM-DD/<uuid>.jpg`, JPEG only, ≤ 10MB
- A server-side trigger checks that the file really exists in Storage and builds `image_url` / `file_size` itself
- Delete / hide / change settings / view stats: only emails listed in `wedding_admins` (and confirmed)
