-- Ensure department_statuses column exists
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS department_statuses JSONB DEFAULT '[]'::jsonb;

-- Initialize department_statuses for existing orders
UPDATE work_orders
SET department_statuses = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'department', dept,
      'status', 'Not Started',
      'updated_at', NOW()::text
    )
  )
  FROM unnest(
    CASE 
      WHEN assigned_departments IS NULL THEN ARRAY[]::text[]
      WHEN jsonb_typeof(assigned_departments::jsonb) = 'array' 
        THEN ARRAY(SELECT jsonb_array_elements_text(assigned_departments::jsonb))
      ELSE string_to_array(assigned_departments::text, ',')
    END
  ) AS dept
  WHERE dept IS NOT NULL AND trim(dept) != ''
)
WHERE (
  department_statuses IS NULL 
  OR department_statuses = '[]'::jsonb
  OR jsonb_array_length(department_statuses) = 0
)
AND assigned_departments IS NOT NULL;

-- Add qty_dispatched column to track dispatched quantities
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS qty_dispatched INTEGER DEFAULT 0;

-- Set default value for existing records
UPDATE work_orders 
SET qty_dispatched = 0 
WHERE qty_dispatched IS NULL;

-- Push subscriptions for background notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  username TEXT,
  department TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_department
  ON push_subscriptions(department)
  WHERE is_active = TRUE;

-- Custom BOM plans (multi-item custom production planning)
CREATE TABLE IF NOT EXISTS custom_bom_plans (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  plan_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_bom_plans_company
  ON custom_bom_plans(company_name);

-- Vehicle support on users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

-- Dispatch metadata on work orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS last_invoice_no TEXT;

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS last_vehicle_no TEXT;

-- Dispatch logs (audit trail for partial/full dispatch)
CREATE TABLE IF NOT EXISTS dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  dispatch_qty INTEGER NOT NULL,
  invoice_no TEXT NOT NULL,
  vehicle_no TEXT NOT NULL,
  dispatched_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_work_order
  ON dispatch_logs(work_order_id);

-- Notification audit trail
CREATE TABLE IF NOT EXISTS notification_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  departments TEXT[] NOT NULL DEFAULT '{}',
  work_order_id BIGINT,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  targets INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_created_at
  ON notification_events(created_at DESC);

-- Vehicles master table
CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  vehicle_no TEXT NOT NULL UNIQUE,
  driver_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_no
  ON vehicles(vehicle_no);

-- 8. Add 'drawing_image_url' and 'drawing_file' to work_orders (snapshot of item PDF at creation)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS drawing_image_url TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS drawing_file TEXT;

-- 9. Add 'entry_date' to work_orders (backfilled from activity_events.event_time)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS entry_date DATE;
