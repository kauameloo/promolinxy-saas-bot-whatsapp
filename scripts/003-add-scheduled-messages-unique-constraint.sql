-- =====================================================
-- MIGRATION: Add unique constraint to prevent duplicate scheduled messages
-- =====================================================
-- This prevents the same flow message from being scheduled multiple times
-- for the same order, which can cause message duplication issues

-- First, remove any existing duplicate messages (keep the earliest one)
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, order_id, flow_message_id
      ORDER BY created_at ASC
    ) AS rn
  FROM scheduled_messages
  WHERE flow_message_id IS NOT NULL
    AND order_id IS NOT NULL
    AND status IN ('pending', 'processing')
)
DELETE FROM scheduled_messages
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique index to prevent future duplicates
-- This ensures that for a given tenant, order, and flow message combination,
-- only one scheduled message can exist in pending or processing state
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_unique_flow_order
ON scheduled_messages (tenant_id, order_id, flow_message_id)
WHERE status IN ('pending', 'processing')
  AND order_id IS NOT NULL
  AND flow_message_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_scheduled_messages_unique_flow_order IS 
'Prevents duplicate scheduling of the same flow message for the same order. Only applies to pending/processing messages.';
