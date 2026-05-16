# PocketBase Collections

Create these collections before running the migrated app. During the first migration pass, use permissive list/view/create/update/delete rules for authenticated/admin users, then harden rules after all flows are verified.

## users

Fields:

- `legacy_id`: number
- `username`: text, required
- `email`: email or text
- `mobile`: text, required
- `passkey`: text, required during temporary migration
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

## Realtime

Enable realtime access for `work_orders`. The frontend subscribes to `work_orders` and maps PocketBase create/update/delete events to the previous Supabase realtime payload shape.

## Data Import

When importing from Supabase, preserve every old numeric `id` in `legacy_id`. Do not overwrite PocketBase's built-in string `id`.
