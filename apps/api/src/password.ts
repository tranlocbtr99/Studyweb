// Password records: pbkdf2$100000$<32 hex salt>$<64 hex derived key>.
// Never store plaintext passwords or return the record to clients.
const toHex = (bytes: Uint8Array) => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map(x => parseInt(x, 16)));
async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  } catch (cause) {
    console.error('studyweb.password.pbkdf2_import_failed', cause instanceof Error ? cause.name : 'unknown');
    throw cause;
  }
  try {
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, 256));
  } catch (cause) {
    console.error('studyweb.password.pbkdf2_derive_failed', cause instanceof Error ? cause.name : 'unknown');
    throw cause;
  }
}
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error('Password length invalid');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return 'pbkdf2$100000$' + toHex(salt) + '$' + toHex(await derive(password, salt, 100000));
}
export async function verifyPassword(password: string, record: string): Promise<boolean> {
  const parts = record.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || !/^\d+$/.test(parts[1]) ||
      !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3]) ||
      Number(parts[1]) < 100000 || Number(parts[1]) > 100000 || password.length > 256) return false;
  const actual = await derive(password, fromHex(parts[2]), Number(parts[1]));
  const expected = fromHex(parts[3]);
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
