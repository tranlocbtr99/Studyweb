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
let validEvents = 0;
let eventsWithLogs = 0;
let logEntries = 0;
const outcomes = new Map();
for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let event;
  try { event = JSON.parse(line); } catch { continue; }
  validEvents++;
  const outcome = String(event.outcome ?? 'unknown');
  const safeOutcome = ['ok', 'exception', 'exceededCpu', 'canceled', 'unknown'].includes(outcome) ? outcome : 'other';
  outcomes.set(safeOutcome, (outcomes.get(safeOutcome) ?? 0) + 1);
  const logs = Array.isArray(event.logs) ? event.logs : [];
  if (logs.length) eventsWithLogs++;
  for (const log of logs) {
    logEntries++;
    const args = Array.isArray(log.message) ? log.message : typeof log.message === 'string' ? [log.message] : [];
    // Wrangler can serialize console arguments as one string; accept only known prefixes.
    const fullMessage = args.length === 1 ? String(args[0]) : '';
    if (fullMessage && !accepted.has(fullMessage)) {
      const prefix = [...accepted].find(x => fullMessage === x || fullMessage.startsWith(x + ' '));
      if (prefix) args.splice(0, args.length, prefix);
    }
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

console.log(JSON.stringify({ validWorkerEvents: validEvents, eventsWithLogs, logEntries, outcomes: Object.fromEntries(outcomes) }));
