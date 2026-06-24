# PocketBase Collections

Create these collections before running the migrated app. During the first migration pass, use permissive list/view/create/update/delete rules for authenticated/admin users, then harden rules after all flows are verified.

## users / erp_users

Create this as a PocketBase **Auth collection** named `erp_users`. The frontend still refers to it as `users` through the compatibility adapter.

Use PocketBase's built-in auth `username` as the normalized 10-digit mobile number. Passwords/passkeys must be stored only through PocketBase Auth password fields, not as plaintext custom fields.

Fields:

- `legacy_id`: number
- `display_name`: text, required
- built-in auth `username`: normalized mobile number, required
- built-in auth `email`: email (**NOTE**: Remove the "Unique" flag on this field to allow multiple users to share the same email address. See PocketBase Admin → erp_users → email field → uncheck "Unique".)
- `login_email`: email or text, required if built-in auth email is not public/readable
- `mobile`: text, required
- `department`: text, required
- `level`: text, required
- `vehicle_number`: text

## departments

Fields:

- `legacy_id`: number
- `name`: text, required
- `incharge`: text
- `supervisor`: text
- `info`: text
- `metrics`: json

## customers

Fields:

- `legacy_id`: number
- `name`: text, required
- `proprietor`: text
- `address`: text
- `city`: text
- `contact`: text
- `email`: email or text
- `gst`: text
- `type`: text
- `reference`: text
- `remarks`: text

## items

Fields:

- `legacy_id`: number
- `name`: text, required
- `customer_name`: text
- `drawing_no`: text
- `drawing_image_url`: url or text (legacy link fallback)
- `drawing_file`: file (drawing PDF/image upload)
- `remarks`: text
- `departments`: json
- `children`: json

## child_items

Fields:

- `legacy_id`: text
- `parent_item_id`: number
- `name`: text, required
- `qty_per_master`: number
- `departments`: json
- `size`: text

## work_orders

Fields:

- `legacy_id`: number
- `customer`: text, required
- `job_details`: text, required
- `drawing`: text
- `qty`: number, required
- `qty_dispatched`: number
- `etd`: text or date
- `ready_date`: text or date
- `status`: text, required
- `assigned_departments`: json
- `department_statuses`: json
- `last_invoice_no`: text
- `last_vehicle_no`: text
- `order_type`: text (`parent` or `suborder`)
- `parent_work_order_id`: number
- `parent_item_name`: text
- `source_item_id`: number
- `source_child_qty`: number
- `drawing_image_url`: text (snapshot of item drawing_image_url at creation)
- `drawing_file`: text (snapshot of item drawing_file filename at creation)
- `entry_date`: date (when the order was created; backfilled from activity_events)

## dispatch_logs

Fields:

- `legacy_id`: number
- `work_order_id`: number, required
- `dispatch_qty`: number, required
- `invoice_no`: text, required
- `vehicle_no`: text, required
- `dispatched_by`: text

## custom_bom_plans

Fields:

- `legacy_id`: number
- `company_name`: text, required
- `plan_name`: text, required
- `plan_items`: json
- `created_by`: text

## push_subscriptions

Fields:

- `user_id`: number
- `username`: text
- `department`: text, required
- `endpoint`: text, required, unique
- `p256dh`: text
- `auth`: text
- `is_active`: bool

## notification_events

Fields:

- `legacy_id`: number
- `title`: text, required
- `body`: text
- `actor`: text
- `departments`: json
- `work_order_id`: number
- `event_time`: date
- `sent`: number
- `failed`: number
- `targets`: number

## activity_events

Fields:

- `legacy_id`: number
- `event_type`: text, required
- `action`: text, required
- `title`: text, required
- `body`: text
- `actor_user_id`: number
- `actor_name`: text
- `actor_department`: text
- `target_collection`: text
- `target_id`: text
- `target_label`: text
- `work_order_id`: number
- `customer_name`: text
- `item_name`: text
- `department`: text
- `old_value`: text
- `new_value`: text
- `metadata`: json
- `severity`: text (`info`, `success`, `warning`, `error`)
- `event_time`: date

## production_reports

Fields:

- `legacy_id`: number
- `department`: text, required
- `item_id`: number, required
- `item_name`: text, required
- `shift_workers`: number
- `shift_hours`: number (default 8)
- `ot_workers`: number
- `ot_hours`: number (default 2)
- `qty_produced`: number
- `total_shift_hours`: number
- `total_ot_hours`: number
- `grand_total_hours`: number
- `date`: text (ISO date string)
- `results`: json (array of `{ metric, unit, qtyPerUnit, totalQty }`)
- `created_by`: text

## Items (updated)

Added field:

- `metric_requirements`: json (array of `{ metric, unit, qtyPerUnit }`)

## Realtime

Enable realtime access for `work_orders`. The frontend subscribes to `work_orders` and maps PocketBase create/update/delete events to the previous Supabase realtime payload shape.

## Data Import

When importing from Supabase, preserve every old numeric `id` in `legacy_id`. Do not overwrite PocketBase's built-in string `id`.
