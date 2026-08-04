# Excell Packaging ERP

React + Vite ERP frontend migrated to PocketBase for data, realtime updates, and notification state.

## Run Locally

Prerequisites: Node.js and PocketBase.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start PocketBase:

   ```sh
   pocketbase serve
   ```

3. Create the collections listed in `pocketbase-collections.md`. Create `erp_users` as a PocketBase Auth collection; login uses normalized mobile number as the auth username plus PocketBase password/passkey authentication.

4. Create `.env.local`:

   ```env
   VITE_POCKETBASE_URL=http://127.0.0.1:8090
   VITE_PUSH_API_URL=http://127.0.0.1:8091/api/send-push
   VITE_ORDER_EMAIL_API_URL=http://127.0.0.1:8091/api/send-order-email
   VITE_VAPID_PUBLIC_KEY=your_public_key
   ```

   Generate real VAPID keys with:

   ```sh
   npm run push:vapid
   ```

   Use the generated public key for `VITE_VAPID_PUBLIC_KEY` and `VAPID_PUBLIC_KEY`. Use the generated private key for `VAPID_PRIVATE_KEY`.

5. Run the app:

   ```sh
   npm run dev
   ```

## Push Relay

Background Web Push runs through `server/push-relay.mjs`. It reads subscriptions from PocketBase, sends Web Push notifications, and writes `notification_events` audit records.

Required environment variables:

```env
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=your_admin_password
PUSH_RELAY_PORT=8091
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@example.com
```

Order emails use the same relay endpoint at `/api/send-order-email`. For Hostinger mail with one real mailbox and aliases, authenticate SMTP with the real mailbox and set the visible sender/reply aliases:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@excellpackaging.in
SMTP_PASS=your_admin_mailbox_password
SMTP_FROM_NAME=Excell Packaging
SMTP_FROM_EMAIL=orders@excellpackaging.in
SMTP_REPLY_TO=support@excellpackaging.in
WEBSITE_ENQUIRY_TO=support@excellpackaging.in
```

The public website enquiry form posts to the relay endpoint `/api/send-website-enquiry`. Set `WEBSITE_ENQUIRY_TO` to the mailbox that should receive public website enquiries.

Frontend order-email calls are authorized with the current PocketBase `erp_users` auth token. `MAIL_API_KEY` is optional and should only be used for server-side curl/manual tests.

Start it with:

```sh
npm run push:relay
```

## Migration Notes

The frontend now imports `src/supabase.ts`, but that file re-exports the PocketBase adapter from `src/pocketbase.ts`. This keeps the existing screens working while Supabase call sites are gradually renamed.

PocketBase record IDs are strings. Existing numeric ERP IDs should be stored in each migrated collection as `legacy_id`; the adapter maps `record.legacy_id` back to `record.id` for current UI compatibility.
