# Test Plan - WhatsApp Engine Fixes

## Overview
This test plan validates the fixes for the "No LID for user" error and message duplication issues.

## Test Environment Setup

### Prerequisites
1. Database with schema applied (including migration 003)
2. WhatsApp Web session connected
3. Backend services running:
   - `npm run start:backend` (port 3001)
   - `npm run start:queue` (port 3002)
4. Test phone numbers ready (both registered and unregistered on WhatsApp)

### Test Data
```sql
-- Test tenant
INSERT INTO tenants (id, name, slug, plan, status) 
VALUES ('test-tenant-001', 'Test Tenant', 'test-tenant', 'pro', 'active');

-- Test customer
INSERT INTO customers (id, tenant_id, name, phone, email) 
VALUES ('test-customer-001', 'test-tenant-001', 'Test Customer', '5511999999999', 'test@example.com');

-- Test flow with 2 messages
INSERT INTO message_flows (id, tenant_id, name, event_type, is_active)
VALUES ('test-flow-001', 'test-tenant-001', 'Test Flow', 'boleto_gerado', true);

INSERT INTO flow_messages (id, flow_id, message_order, content, delay_minutes, is_active)
VALUES 
  ('test-msg-001', 'test-flow-001', 1, 'First message to {{nome}}', 0, true),
  ('test-msg-002', 'test-flow-001', 2, 'Second message to {{nome}}', 5, true);
```

## Test Cases

### Test Suite 1: Phone Number Normalization

#### TC-1.1: Standard International Format
**Input**: `+5511999999999`
**Expected**: Normalized to `5511999999999`, message sent successfully
**Steps**:
```bash
curl -X POST http://localhost:3001/api/whatsapp/send/test-tenant-001 \
  -H "Content-Type: application/json" \
  -d '{"to": "+5511999999999", "content": "Test message"}'
```
**Pass Criteria**: `{"success": true, "data": {"messageId": "..."}}`

#### TC-1.2: Format with Parentheses and Hyphens
**Input**: `(55) 11 99999-9999`
**Expected**: Normalized to `5511999999999`, message sent successfully
**Steps**: Same as TC-1.1, change "to" value
**Pass Criteria**: Success response

#### TC-1.3: Format without Country Code
**Input**: `11999999999`
**Expected**: Should work if >= 10 digits
**Pass Criteria**: Success response

#### TC-1.4: Invalid Format (Too Short)
**Input**: `999999`
**Expected**: Error "Invalid phone number format"
**Steps**: Same as TC-1.1
**Pass Criteria**: `{"success": false, "error": "Invalid phone number format: 999999"}`

#### TC-1.5: Format with Spaces and Dots
**Input**: `55 11 9.9999.9999`
**Expected**: Normalized to `5511999999999`
**Pass Criteria**: Success response

### Test Suite 2: Contact Registration Check

#### TC-2.1: Registered WhatsApp Number
**Setup**: Use a known WhatsApp number
**Expected**: Message sent successfully
**Steps**: Same as TC-1.1 with registered number
**Pass Criteria**: Success response

#### TC-2.2: Unregistered Number
**Setup**: Use a number known to not be on WhatsApp
**Expected**: Error indicating number not registered
**Steps**: Same as TC-1.1 with unregistered number
**Pass Criteria**: 
```json
{
  "success": false,
  "error": "Number ... is not registered on WhatsApp"
}
```

#### TC-2.3: Check Logs for Registration Verification
**Steps**: Check backend logs after TC-2.1
**Pass Criteria**: Log should contain:
```
[WhatsApp Engine] Message sent to 5511999999999: Test message...
```

### Test Suite 3: LID Error Handling

#### TC-3.1: Simulate LID Error (Mock)
**Setup**: Modify test to trigger LID error scenario
**Expected**: Friendly error message returned
**Pass Criteria**: Error message contains "Contact not found in WhatsApp"

#### TC-3.2: Verify Error Logging
**Steps**: Check logs after LID error
**Pass Criteria**: Log contains:
```
[WhatsApp Engine] LID error for ... This usually means the contact info hasn't synced properly.
```

### Test Suite 4: Message Duplication Prevention

#### TC-4.1: Schedule Flow Messages Once
**Steps**:
```bash
# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-001",
    "customer_id": "test-customer-001",
    "product_name": "Test Product",
    "amount": 100.00,
    "status": "pending"
  }'

# Trigger webhook to schedule messages
curl -X POST http://localhost:3001/api/webhooks/cakto \
  -H "Content-Type: application/json" \
  -d '{
    "event": "boleto_gerado",
    "transaction_id": "test-001",
    "customer": {"name": "Test Customer", "phone": "5511999999999"},
    "product": {"name": "Test Product", "price": 100.00}
  }'
```
**Expected**: 2 messages scheduled (one per flow message)
**Verify**:
```sql
SELECT COUNT(*) FROM scheduled_messages 
WHERE tenant_id = 'test-tenant-001' 
AND status = 'pending';
-- Should return: 2
```

#### TC-4.2: Duplicate Webhook (Should Not Create Duplicates)
**Steps**: Send the same webhook payload twice
**Expected**: Still only 2 messages scheduled
**Verify**: Same SQL query as TC-4.1, still returns 2

#### TC-4.3: Check Database Constraint
**Steps**:
```sql
-- Try to manually insert duplicate
INSERT INTO scheduled_messages (
  tenant_id, customer_id, order_id, flow_id, flow_message_id,
  phone, message_content, scheduled_for, status, attempts
) VALUES (
  'test-tenant-001', 'test-customer-001', '<order_id>', 
  'test-flow-001', 'test-msg-001',
  '5511999999999', 'Test', NOW(), 'pending', 0
);
```
**Expected**: Database error with unique constraint violation
**Pass Criteria**: Error message contains "idx_scheduled_messages_unique_flow_order"

#### TC-4.4: Batch Query Performance
**Steps**: Schedule flow with 10 messages, measure query count
**Expected**: 1 batch query to check existing + 10 inserts = 11 queries total
**Monitor**: Database query logs or use `EXPLAIN ANALYZE`

### Test Suite 5: End-to-End Flow

#### TC-5.1: Complete Order Flow
**Steps**:
1. Create customer with phone `+5511999999999`
2. Create order for customer
3. Send webhook for `boleto_gerado` event
4. Wait for queue worker to process
5. Check message logs

**Expected Results**:
- 2 messages in `scheduled_messages` table with status `pending`
- After queue processing: both messages have status `sent`
- 2 entries in `message_logs` with status `sent`
- Customer receives 2 WhatsApp messages

**Verify**:
```sql
-- Check scheduled messages
SELECT id, flow_message_id, status, attempts 
FROM scheduled_messages 
WHERE tenant_id = 'test-tenant-001' 
ORDER BY scheduled_for;

-- Check message logs
SELECT phone, message_content, status, sent_at 
FROM message_logs 
WHERE tenant_id = 'test-tenant-001' 
ORDER BY created_at DESC 
LIMIT 2;
```

#### TC-5.2: Multiple Orders, No Cross-Contamination
**Steps**:
1. Create 2 different orders for same customer
2. Trigger webhooks for both orders
3. Verify messages are separate

**Expected**: 4 messages total (2 per order), no duplicates
**Verify**:
```sql
SELECT order_id, COUNT(*) as message_count
FROM scheduled_messages
WHERE tenant_id = 'test-tenant-001'
GROUP BY order_id;
-- Should return 2 rows, each with count = 2
```

### Test Suite 6: Error Recovery

#### TC-6.1: Session Disconnection Recovery
**Steps**:
1. Disconnect WhatsApp session
2. Try to send message
3. Verify error handling

**Expected**: Error "WhatsApp not connected"
**Verify**: No crash, graceful error response

#### TC-6.2: Puppeteer Page Error
**Setup**: Simulate puppeteer page being null
**Expected**: Error message about reconnecting
**Pass Criteria**: 
- Error contains "Puppeteer page indisponível"
- Session marked as disconnected
- Reconnection scheduled

#### TC-6.3: Retry Logic for Failed Messages
**Steps**:
1. Create message that will fail (e.g., invalid number)
2. Check `scheduled_messages` table for retry attempts
3. Verify max retry limit is respected

**Expected**: 
- `attempts` incremented up to 3
- Status changes to `failed` after 3 attempts
- Error message logged

**Verify**:
```sql
SELECT attempts, status, error_message 
FROM scheduled_messages 
WHERE id = '<failed_message_id>';
```

## Performance Tests

### PT-1: High Volume Message Scheduling
**Setup**: Flow with 50 messages
**Steps**: Schedule messages for 100 orders
**Expected**: 
- Batch query used (not 5000 individual queries)
- All messages scheduled within 10 seconds
- No duplicate messages

### PT-2: Queue Worker Performance
**Setup**: 1000 pending messages
**Steps**: Start queue worker, measure processing time
**Expected**: 
- Processes at least 100 messages per minute
- No memory leaks
- Graceful handling of errors

## Regression Tests

### RT-1: Existing Messages Still Work
**Steps**: Send message using old API format (if any)
**Expected**: Still works with backward compatibility

### RT-2: Database Performance
**Steps**: Run EXPLAIN ANALYZE on key queries
**Expected**: All queries use indexes efficiently

### RT-3: No Breaking Changes
**Steps**: Deploy to staging, run existing integration tests
**Expected**: All existing tests pass

## Automated Test Script

```bash
#!/bin/bash
# run_tests.sh

echo "=== WhatsApp Engine Fix Tests ==="

# Test 1: Phone normalization
echo "Testing phone normalization..."
curl -X POST http://localhost:3001/api/whatsapp/send/test-tenant-001 \
  -H "Content-Type: application/json" \
  -d '{"to": "(55) 11 99999-9999", "content": "Normalization test"}' \
  | jq .

# Test 2: Invalid phone
echo "Testing invalid phone..."
curl -X POST http://localhost:3001/api/whatsapp/send/test-tenant-001 \
  -H "Content-Type: application/json" \
  -d '{"to": "123", "content": "Should fail"}' \
  | jq .

# Test 3: Check database constraint
echo "Checking database constraint..."
psql $DATABASE_URL -c "
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_scheduled_messages_unique_flow_order'
  );
"

# Test 4: No duplicate messages
echo "Testing duplicate prevention..."
WEBHOOK_PAYLOAD='{
  "event": "boleto_gerado",
  "transaction_id": "test-'$(date +%s)'",
  "customer": {"name": "Test", "phone": "5511999999999"},
  "product": {"name": "Test", "price": 100}
}'

# Send webhook twice
curl -X POST http://localhost:3001/api/webhooks/cakto \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD"

sleep 1

curl -X POST http://localhost:3001/api/webhooks/cakto \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD"

# Check for duplicates
psql $DATABASE_URL -c "
  SELECT tenant_id, order_id, flow_message_id, COUNT(*) as count
  FROM scheduled_messages
  WHERE status IN ('pending', 'processing')
  GROUP BY tenant_id, order_id, flow_message_id
  HAVING COUNT(*) > 1;
"

echo "=== Tests Complete ==="
```

## Manual Verification Checklist

- [ ] Phone numbers with different formats are normalized correctly
- [ ] Unregistered numbers are detected and rejected
- [ ] LID errors show friendly messages
- [ ] No duplicate messages in scheduled_messages table
- [ ] Database constraint exists: `idx_scheduled_messages_unique_flow_order`
- [ ] Messages are sent successfully to real WhatsApp numbers
- [ ] Queue worker processes messages without errors
- [ ] Logs show proper error messages and debugging info
- [ ] No memory leaks or performance degradation
- [ ] Session reconnection works after errors

## Success Criteria

All test cases must pass with:
- ✅ No security vulnerabilities
- ✅ No database constraint violations
- ✅ Proper error handling and logging
- ✅ Zero message duplication
- ✅ Successful message delivery rate > 95%
- ✅ Average message processing time < 5 seconds

## Known Limitations

1. Contact registration check may return false positives if WhatsApp session is not fully synchronized
2. Phone number normalization assumes minimum 10 digits - may need adjustment for different regions
3. Unique constraint only applies to pending/processing messages - sent/failed messages can have same combination

## Rollback Plan

If tests fail:
1. Stop all services
2. Revert database migration (DROP INDEX)
3. Revert code changes (git revert)
4. Restart services
5. Investigate logs and errors
6. Fix issues and retest
