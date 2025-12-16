// Test script to verify date scheduling logic
console.log("=== Testing Date Scheduling Logic ===\n");

// Simulate the NEW (absolute) scheduling logic
function testNewLogic() {
  console.log("NEW Logic Test (Absolute from Trigger):");
  const messages = [
    { id: 1, delay_minutes: 0 },
    { id: 2, delay_minutes: 30 },
    { id: 3, delay_minutes: 180 },
  ];

  const triggerTime = new Date();
  console.log(`Trigger time: ${triggerTime.toISOString()}`);

  for (const message of messages) {
    const scheduledFor = new Date(triggerTime);
    scheduledFor.setMinutes(scheduledFor.getMinutes() + message.delay_minutes);
    
    console.log(`Message ${message.id}:`);
    console.log(`  delay_minutes: ${message.delay_minutes}`);
    console.log(`  scheduledFor: ${scheduledFor.toISOString()}`);
    console.log(`  Minutes from trigger: ${message.delay_minutes}\n`);
  }
}

// Simulate the OLD (cumulative) scheduling logic
function testOldLogic() {
  console.log("\nOLD Logic Test (Cumulative):");
  const messages = [
    { id: 1, delay_minutes: 0 },
    { id: 2, delay_minutes: 30 },
    { id: 3, delay_minutes: 180 },
  ];

  let cumulativeDelay = 0;
  const now = new Date();
  console.log(`Start time: ${now.toISOString()}`);

  for (const message of messages) {
    cumulativeDelay += message.delay_minutes;
    
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + cumulativeDelay);
    
    console.log(`Message ${message.id}:`);
    console.log(`  delay_minutes: ${message.delay_minutes}`);
    console.log(`  cumulativeDelay: ${cumulativeDelay}`);
    console.log(`  scheduledFor: ${scheduledFor.toISOString()}`);
    console.log(`  Minutes from now: ${cumulativeDelay}\n`);
  }
}

// Comparison for user understanding
function comparison() {
  console.log("\n=== COMPARISON ===");
  console.log("User configures messages with delays: 0, 30, 180 minutes");
  console.log("\nOLD behavior (cumulative):");
  console.log("  Message 1: NOW + 0 = NOW");
  console.log("  Message 2: NOW + (0+30) = 30 min");
  console.log("  Message 3: NOW + (0+30+180) = 210 min (3.5 hours)");
  console.log("\nNEW behavior (absolute from trigger):");
  console.log("  Message 1: Trigger + 0 = NOW");
  console.log("  Message 2: Trigger + 30 = 30 min");
  console.log("  Message 3: Trigger + 180 = 180 min (3 hours)");
  console.log("\n✓ NEW behavior is more intuitive!");
}

testNewLogic();
testOldLogic();
comparison();

