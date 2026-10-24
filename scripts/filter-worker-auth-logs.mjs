import readline from 'node:readline';

const accepted = new Set([
  'studyweb.auth.rate_limit: missing_or_invalid_client_ip',
  'studyweb.auth.rate_limit: storage_failure',
  'studyweb.auth.login: storage_or_crypto_failure',
  'studyweb.auth.registration: missing_or_invalid_client_ip',
  'studyweb.auth.registration: failure'
]);
const stages = new Set(['user_lookup', 'password_verification', 'session_creation',
  'rate_limit', 'duplicate_check', 'password_hashing', 'user_creation']);
const kinds = new Set(['Error', 'TypeError', 'RangeError', 'DOMException', 'OperationError',
  'NotSupportedError', 'QuotaExceededError', 'DataError', 'AbortError', 'unknown']);
let matched = 0;
for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let event;
  try { event = JSON.parse(line); } catch { continue; }
  for (const log of event.logs ?? []) {
    const args = Array.isArray(log.message) ? log.message : [];
    const message = String(args[0] ?? '');
    if (!accepted.has(message)) continue;
    const stage = stages.has(args[1]) ? args[1] : '-';
    const kindCandidate = message.includes('login:') ? args[2] : message.includes('registration: failure') ? args[2] : args[1];
    const kind = kinds.has(kindCandidate) ? kindCandidate : '-';
    console.log(JSON.stringify({ event: message, stage, errorType: kind }));
    matched++;
  }
}
console.log(`Filtered authentication diagnostic events: ${matched}`);
