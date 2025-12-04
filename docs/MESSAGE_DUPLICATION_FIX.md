# Message Duplication Fix

## Problem

When adding a second message to a flow, it would be duplicated and sent twice to users. This issue was particularly visible in the message logs where the same message would appear multiple times with identical timestamps.

### Log Evidence

```
[Message Queue] Processing 1 messages
[Queue Worker] Processing message 7bc20301-a26f-4f59-80f4-78ed036887ba for 5511913390707
[WhatsApp Engine] Message sent to 5511913390707: 00020101...
[WhatsApp Engine] Message sent to 5511913390707: 00020101...  <-- DUPLICATE!
[Message Queue] Message 7bc20301... sent successfully
[Queue Worker] Message 7bc20301... sent successfully
```

## Root Cause

The system had **two separate queue processing systems running simultaneously**:

1. **Internal MessageQueue** (from `message-queue.ts`)
   - Instantiated within `whatsapp-server.ts`
   - Configured via `startMessageQueue()` function
   - Stored in `activeQueues` Map

2. **Standalone Queue Worker** (from `queue-worker.ts`)
   - Runs as a separate PM2 process
   - Configured in `ecosystem.config.js`
   - Completely independent from the WhatsApp server

### The Race Condition

Both systems would:
1. Query the database for messages with `status = 'pending'`
2. Fetch the same messages at nearly the same time
3. Process and send messages independently
4. Result: Messages sent **twice**

Even though both systems marked messages as "processing" before sending, the race condition occurred because:
- Both fetched messages **before** either could update the status
- Database queries were not atomic/locked
- No coordination between the two systems

## Solution

**Completely removed the internal MessageQueue from `whatsapp-server.ts`**, leaving only the standalone queue-worker to handle message processing.

### Changes Made

1. **Removed MessageQueue import**
   ```typescript
   // Before:
   import { MessageQueue } from "./lib/message-queue"
   
   // After:
   // MessageQueue removed - using standalone queue-worker instead to avoid duplicate processing
   ```

2. **Removed activeQueues Map**
   ```typescript
   // Removed:
   const activeQueues: Map<string, MessageQueue> = new Map()
   ```

3. **Removed queue management functions**
   - Deleted `startMessageQueue(tenantId, engine)` function
   - Deleted `stopMessageQueue(tenantId)` function

4. **Removed all queue-related calls**
   - Removed `stopMessageQueue()` calls from disconnect handlers
   - Updated event handlers to only log, not manage queues

5. **Updated shutdown logic**
   - Removed queue cleanup from SIGTERM handler
   - Added session preservation on restart (since queue-worker is separate)

## Architecture After Fix

```
┌─────────────────────┐
│  whatsapp-server.ts │
│  (WhatsApp Engine)  │
│                     │
│  - Manages WhatsApp │
│    connections      │
│  - Provides API for │
│    sending messages │
│  - NO queue         │
│    processing       │
└─────────────────────┘
         ↑
         │ HTTP API calls
         │
┌─────────────────────┐
│   queue-worker.ts   │
│  (Message Processor)│
│                     │
│  - Fetches pending  │
│    messages from DB │
│  - Calls WhatsApp   │
│    server API       │
│  - Handles retries  │
└─────────────────────┘
```

## Deployment

The system uses PM2 to manage both processes:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "whatsapp-engine",
      script: "./dist/whatsapp-server.js",
      // Only manages WhatsApp connections
    },
    {
      name: "message-queue",
      script: "./dist/queue-worker.js",
      // Handles all message processing
    }
  ]
}
```

## Testing the Fix

### Before Deployment
1. Build the backend: `npm run build:backend`
2. Verify no compilation errors
3. Check that no MessageQueue references remain in `dist/whatsapp-server.js`

### After Deployment
1. Create a flow with 2+ messages
2. Trigger the flow via webhook
3. Monitor logs to verify:
   - Only `[Queue Worker]` processes messages
   - No `[Message Queue]` logs appear
   - Each message is sent exactly once
4. Check message_logs table for duplicates

### Expected Logs (After Fix)
```
[Queue Worker] Processing batch of 2 messages
[Queue Worker] Processing message xxx-111 for 5511913390707
[WhatsApp Engine] Message sent to 5511913390707: Message 1
[Queue Worker] Message xxx-111 sent successfully
[Queue Worker] Processing message xxx-222 for 5511913390707
[WhatsApp Engine] Message sent to 5511913390707: Message 2
[Queue Worker] Message xxx-222 sent successfully
```

## Prevention

To prevent this issue from reoccurring:

1. **Never instantiate MessageQueue in whatsapp-server.ts**
   - The standalone queue-worker is the ONLY queue processor
   - WhatsApp server should only expose APIs

2. **Keep queue processing separate**
   - Queue worker runs as independent PM2 process
   - Clear separation of concerns

3. **Monitor logs**
   - Watch for `[Message Queue]` logs (should never appear)
   - Only `[Queue Worker]` should process messages

## Security

CodeQL analysis completed with **0 vulnerabilities** found in the changes.

## Rollback

If issues arise, rollback by:
1. Reverting to commit before `e827063`
2. Rebuilding: `npm run build:backend`
3. Restarting PM2: `pm2 restart all`

However, this will restore the duplicate message bug.

## Related Files

- `src/backend/whatsapp-server.ts` - WhatsApp connection manager (modified)
- `src/backend/queue-worker.ts` - Message processor (unchanged)
- `src/backend/lib/message-queue.ts` - Queue class (no longer used by server)
- `ecosystem.config.js` - PM2 configuration (unchanged)
