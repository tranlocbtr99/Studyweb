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
let parsedJsonLines = 0;
let arrayEnvelopeLines = 0;
let primitiveJsonLines = 0;
let eventsWithLogs = 0;
let logEntries = 0;
let httpResponses = 0;
const statusCounts = new Map();
const methodCounts = new Map();
const eventShapes = new Map();
const outcomes = new Map();
let pending = '';
for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  // Wrangler emits pretty-printed JSON objects across multiple lines.
  // Keep the envelope intact instead of parsing nested scalar lines as events.
  if (!pending && !line.trim()) continue;
  pending += line + '\n';
  let event;
  try { event = JSON.parse(pending); } catch {
    if (pending.length > 2_000_000 || (!pending.trimStart().startsWith('{') && !pending.trimStart().startsWith('['))) pending = '';
    continue;
  }
  pending = ''; 
  parsedJsonLines++;
  if (Array.isArray(event)) {
    arrayEnvelopeLines++;
    // Wrangler may emit an array of events in a single JSON line.
    for (const entry of event) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) inspect(entry);
    }
    continue;
  }
  if (!event || typeof event !== 'object') { primitiveJsonLines++; continue; }
  inspect(event);
}
function inspect(event) {
  validEvents++;
  const shape = Object.keys(event).filter(key => ['outcome', 'logs', 'event', 'exceptions', 'message'].includes(key)).sort().join(',') || 'other';
  eventShapes.set(shape, (eventShapes.get(shape) ?? 0) + 1);
  const request = event.event?.request;
  const response = event.event?.response;
  const method = request?.method;
  if (method === 'POST' || method === 'GET') methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
  const status = response?.status;
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    httpResponses++;
    const statusClass = String(Math.floor(status / 100)) + 'xx';
    statusCounts.set(statusClass, (statusCounts.get(statusClass) ?? 0) + 1);
  }
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

console.log(JSON.stringify({ validWorkerEvents: validEvents, parsedJsonLines, arrayEnvelopeLines, primitiveJsonLines, eventsWithLogs, logEntries, outcomes: Object.fromEntries(outcomes), httpResponses, statusClasses: Object.fromEntries(statusCounts), methods: Object.fromEntries(methodCounts), eventShapes: Object.fromEntries(eventShapes) }));
