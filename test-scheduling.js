// Test script to verify date scheduling logic
console.log("=== Testing Date Scheduling Logic ===\n");

// Simulate the current scheduling logic
function testCurrentLogic() {
  console.log("Current Logic Test:");
  const messages = [
    { id: 1, delay_minutes: 0 },
    { id: 2, delay_minutes: 15 },
    { id: 3, delay_minutes: 120 },
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

// Test with real timestamps from the issue
function testWithRealData() {
  console.log("\n=== Real Data Analysis ===");
  const createdAt = new Date("2025-12-16T21:40:44.194546Z");
  console.log(`Webhook received at: ${createdAt.toISOString()}`);
  
  const scheduledTimes = [
    { msg: 1, time: "2025-12-16T21:40:44.119Z", expected_delay: 0 },
    { msg: 2, time: "2025-12-16T21:55:44.243Z", expected_delay: 15 },
    { msg: 3, time: "2025-12-16T23:55:44.366Z", expected_delay: 135 },
  ];
  
  scheduledTimes.forEach(({msg, time, expected_delay}) => {
    const scheduled = new Date(time);
    const actualDelay = Math.round((scheduled - createdAt) / 1000 / 60);
    console.log(`Message ${msg}:`);
    console.log(`  Scheduled: ${scheduled.toISOString()}`);
    console.log(`  Actual delay: ${actualDelay} minutes`);
    console.log(`  Expected delay: ${expected_delay} minutes`);
    console.log(`  Difference: ${actualDelay - expected_delay} minutes\n`);
  });
}

testCurrentLogic();
testWithRealData();
