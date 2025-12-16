#!/usr/bin/env node
// Simple helper to POST a JSON file to a webhook URL
// Usage: node scripts/send-webhook.js http://localhost:3001/api/zender/webhook scripts/mock-zender-message.json

const fs = require('fs');
const path = require('path');

async function main() {
  const [,, urlArg, fileArg] = process.argv;
  const url = urlArg || 'http://localhost:3001/api/zender/webhook';
  const file = fileArg || path.join(__dirname, 'mock-zender-message.json');

  if (!fs.existsSync(file)) {
    console.error(`[send-webhook] Payload file not found: ${file}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`[send-webhook] POST ${url} with ${path.basename(file)}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[send-webhook] Status: ${res.status}`);
    console.log(text);
  } catch (err) {
    console.error('[send-webhook] Error:', err);
    process.exit(1);
  }
}

main();
