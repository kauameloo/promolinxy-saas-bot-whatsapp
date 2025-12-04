# WhatsApp Engine Error Fixes

## Summary

This document describes the fixes implemented to resolve WhatsApp message sending errors and message duplication issues.

## Issues Addressed

### 1. "No LID for user" Error

**Problem**: WhatsApp messages were failing with the error "No LID for user" when attempting to send messages through the WhatsApp Engine.

**Root Cause**: The error originates from the whatsapp-web.js library when:
- Phone numbers are not properly formatted
- Contact information hasn't synchronized properly in the WhatsApp session
- The recipient's number is not registered on WhatsApp

**Solution Implemented**:
1. **Phone Number Normalization** (`normalizePhoneNumber` method):
   - Removes all non-numeric characters except leading `+`
   - Validates phone number has at least 10 digits
   - Ensures consistent format before sending messages

2. **Contact Registration Check** (`isRegisteredWhatsAppNumber` method):
   - Verifies if the phone number is registered on WhatsApp before sending
   - Prevents "No LID" errors by checking contact existence
   - Returns user-friendly error messages when numbers aren't registered

3. **Enhanced Error Handling**:
   - Specific error detection for LID-related failures
   - User-friendly error messages explaining the issue
   - Automatic reconnection logic for session errors

**Files Modified**:
- `src/backend/lib/whatsapp-engine.ts`

### 2. Message Duplication Issue

**Problem**: When adding a second message to a flow, the second message was being duplicated and sent twice to recipients.

**Root Cause**: 
- No unique constraint existed to prevent scheduling the same flow message multiple times for the same order
- Concurrent or repeated webhook processing could schedule duplicate messages
- No pre-check before inserting scheduled messages

**Solution Implemented**:
1. **Database Migration** (`scripts/003-add-scheduled-messages-unique-constraint.sql`):
   - Removes existing duplicate messages (keeps earliest)
   - Adds unique partial index on `(tenant_id, order_id, flow_message_id)` for pending/processing messages
   - Prevents duplicate scheduling at the database level

2. **Application-Level Duplicate Check** (`message-service.ts`):
   - Checks for existing scheduled messages before inserting
   - Handles unique constraint violations gracefully
   - Logs duplicate detection in debug mode

**Files Modified**:
- `lib/services/message-service.ts`
- `scripts/003-add-scheduled-messages-unique-constraint.sql` (new file)

## Implementation Details

### Phone Number Normalization

```typescript
private normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except + at the start
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1)
  }
  
  // Ensure we have a valid phone number (at least 10 digits)
  if (normalized.length < 10) {
    throw new Error(`Invalid phone number format: ${phone}`)
  }
  
  return normalized
}
```

### Contact Registration Check

```typescript
private async isRegisteredWhatsAppNumber(chatId: string): Promise<boolean> {
  try {
    if (!this.client) return false
    
    // Use whatsapp-web.js method to check if number is registered
    const isRegistered = await this.client.isRegisteredUser(chatId)
    return isRegistered
  } catch (error) {
    console.warn(`[WhatsApp Engine] Error checking if number is registered: ${chatId}`, error)
    // If we can't check, assume it's registered to avoid blocking sends
    return true
  }
}
```

### Duplicate Prevention

The unique index ensures database-level prevention:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_unique_flow_order
ON scheduled_messages (tenant_id, order_id, flow_message_id)
WHERE status IN ('pending', 'processing')
  AND order_id IS NOT NULL
  AND flow_message_id IS NOT NULL;
```

Application-level check before insert:
```typescript
// Check if this exact message is already scheduled
const existing = await queryOne<ScheduledMessage>(
  `SELECT id FROM scheduled_messages 
   WHERE tenant_id = $1 
   AND order_id = $2 
   AND flow_message_id = $3 
   AND status IN ('pending', 'processing')
   LIMIT 1`,
  [this.tenantId, order.id, message.id]
)

if (existing) {
  if (isDebugMode) {
    console.log(`  ⊗ Message already scheduled, skipping`)
  }
  continue
}
```

## Deployment Instructions

### 1. Deploy Code Changes

```bash
# Pull the latest changes
git pull origin copilot/fix-whatsapp-engine-error

# Install dependencies (if needed)
npm install

# Build the backend
npm run build:backend

# Restart services
npm run start:backend
npm run start:queue
```

### 2. Apply Database Migration

**IMPORTANT**: Run this migration on your database before deploying the code changes.

```bash
# Connect to your PostgreSQL database
psql -U your_user -d your_database

# Run the migration
\i scripts/003-add-scheduled-messages-unique-constraint.sql
```

Or using environment variables:
```bash
psql $DATABASE_URL -f scripts/003-add-scheduled-messages-unique-constraint.sql
```

### 3. Verify the Fix

After deployment, verify:

1. **Phone Number Validation**:
   - Try sending messages with different phone formats
   - Check logs for normalization messages
   - Verify unregistered numbers are caught

2. **No Duplication**:
   - Trigger a flow with multiple messages
   - Check `scheduled_messages` table for duplicates
   - Verify only one entry per flow message + order combination

3. **Error Messages**:
   - Check application logs for improved error messages
   - Verify LID errors are caught and handled gracefully

## Testing Scenarios

### Test 1: Phone Number Formats
```
Input formats to test:
- "+5511999999999"
- "5511999999999"
- "(55) 11 99999-9999"
- "11 99999-9999"

Expected: All should normalize to "5511999999999"
```

### Test 2: Unregistered Number
```
Try sending to a number not on WhatsApp
Expected: Error message "Number XXX is not registered on WhatsApp"
```

### Test 3: Message Duplication
```
1. Create a flow with 2 messages
2. Trigger the flow via webhook
3. Check scheduled_messages table
Expected: Exactly 2 messages scheduled, no duplicates
```

### Test 4: Duplicate Webhook
```
1. Send the same webhook twice
2. Check scheduled_messages table
Expected: Still only 2 messages (not 4)
```

## Monitoring

### Key Metrics to Monitor

1. **Message Success Rate**:
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'sent') as sent,
     COUNT(*) FILTER (WHERE status = 'failed') as failed,
     COUNT(*) FILTER (WHERE error_message LIKE '%LID%') as lid_errors
   FROM scheduled_messages
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Duplicate Prevention**:
   ```sql
   SELECT tenant_id, order_id, flow_message_id, COUNT(*) as count
   FROM scheduled_messages
   WHERE status IN ('pending', 'processing')
   GROUP BY tenant_id, order_id, flow_message_id
   HAVING COUNT(*) > 1;
   ```
   This query should return 0 rows after the fix.

3. **Phone Number Issues**:
   ```bash
   # Check logs for normalization errors
   grep "Invalid phone number format" /var/log/whatsapp-server.log
   ```

## Rollback Plan

If issues occur after deployment:

1. **Revert Code**:
   ```bash
   git revert HEAD~2..HEAD
   git push origin copilot/fix-whatsapp-engine-error
   ```

2. **Remove Database Constraint** (if needed):
   ```sql
   DROP INDEX IF EXISTS idx_scheduled_messages_unique_flow_order;
   ```

3. **Restart Services**:
   ```bash
   npm run start:backend
   npm run start:queue
   ```

## Future Improvements

1. **Rate Limiting**: Add rate limiting per phone number to prevent spam
2. **Retry Logic**: Implement exponential backoff for LID errors
3. **Contact Sync**: Periodic sync of WhatsApp contacts to prevent LID errors
4. **Message Queue Optimization**: Batch process messages to reduce database queries

## Support

For issues or questions:
1. Check application logs: `/var/log/whatsapp-server.log`
2. Check database for constraint violations
3. Review this document for common scenarios
4. Contact the development team

## References

- [whatsapp-web.js Documentation](https://github.com/pedroslopez/whatsapp-web.js)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- Original issue: "No LID for user" error when sending WhatsApp messages
