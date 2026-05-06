/**
 * Minimal WebAuthn server helpers (Workers/Pages Functions runtime).
 *
 * Adapted from the Modih Mail implementation:
 *   modih-email/functions/_webauthn.js (same author, same architecture).
 *
 * Only ES256 (COSE alg -7, the default for Apple/Android passkeys) is
 * supported. Callers in `functions/api/auth/passkeys.ts` orchestrate
 * registration and login on top of these primitives.
 */

// ── base64url ────────────────────────────────────────────────────────────────
export function b64uToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64u(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── CBOR (subset) ───────────────────────────────────────────────────────────
class CborReader {
  b: Uint8Array;
  pos = 0;
  constructor(b: Uint8Array) {
    this.b = b;
  }
  ensure(n: number) {
    if (this.pos + n > this.b.length) throw new Error("cbor: truncated input");
  }
  readByte(): number {
    this.ensure(1);
    return this.b[this.pos++];
  }
  readN(n: number): Uint8Array {
    this.ensure(n);
    const slice = this.b.slice(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }
  readUint(info: number): number {
    if (info < 24) return info;
    if (info === 24) return this.readByte();
    if (info === 25) {
      const a = this.readByte();
      const b = this.readByte();
      return (a << 8) | b;
    }
    if (info === 26) {
      const a = this.readByte();
      const b = this.readByte();
      const c = this.readByte();
      const d = this.readByte();
      return a * 0x1000000 + ((b << 16) | (c << 8) | d);
    }
    throw new Error("cbor: 64-bit lengths not supported");
  }
  readItem(): unknown {
    const initial = this.readByte();
    const major = initial >> 5;
    const info = initial & 0x1f;
    switch (major) {
      case 0:
        return this.readUint(info);
      case 1:
        return -1 - this.readUint(info);
      case 2:
        return this.readN(this.readUint(info));
      case 3: {
        const bytes = this.readN(this.readUint(info));
        return new TextDecoder().decode(bytes);
      }
      case 4: {
        const len = this.readUint(info);
        const arr: unknown[] = new Array(len);
        for (let i = 0; i < len; i++) arr[i] = this.readItem();
        return arr;
      }
      case 5: {
        const len = this.readUint(info);
        const m = new Map<unknown, unknown>();
        for (let i = 0; i < len; i++) {
          const k = this.readItem();
          const v = this.readItem();
          m.set(k, v);
        }
        return m;
      }
      case 7:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return undefined;
        throw new Error("cbor: unsupported simple value " + info);
      default:
        throw new Error("cbor: unsupported major type " + major);
    }
  }
}
export function cborDecode(bytes: Uint8Array): unknown {
  return new CborReader(bytes).readItem();
}

// ── authData ────────────────────────────────────────────────────────────────
export type ParsedAuthData = {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  userPresent: boolean;
  userVerified: boolean;
  aaguid: Uint8Array | null;
  credId: Uint8Array | null;
  coseKey: Uint8Array | null;
};

export function parseAuthData(authData: Uint8Array): ParsedAuthData {
  if (!(authData instanceof Uint8Array) || authData.length < 37)
    throw new Error("authData: too short");
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount =
    (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
  const userPresent = (flags & 0x01) === 0x01;
  const userVerified = (flags & 0x04) === 0x04;
  const attestedDataIncluded = (flags & 0x40) === 0x40;
  let aaguid: Uint8Array | null = null;
  let credId: Uint8Array | null = null;
  let coseKey: Uint8Array | null = null;
  if (attestedDataIncluded) {
    if (authData.length < 55) throw new Error("authData: attested data truncated");
    aaguid = authData.slice(37, 53);
    const credIdLen = (authData[53] << 8) | authData[54];
    if (authData.length < 55 + credIdLen) throw new Error("authData: credId truncated");
    credId = authData.slice(55, 55 + credIdLen);
    coseKey = authData.slice(55 + credIdLen);
  }
  return {
    rpIdHash,
    flags,
    signCount: signCount >>> 0,
    userPresent,
    userVerified,
    aaguid,
    credId,
    coseKey,
  };
}

// ── COSE → CryptoKey ────────────────────────────────────────────────────────
export async function importCoseEs256(coseBytes: Uint8Array): Promise<CryptoKey> {
  const decoded = cborDecode(coseBytes);
  if (!(decoded instanceof Map)) throw new Error("cose: not a map");
  const kty = decoded.get(1);
  const alg = decoded.get(3);
  const crv = decoded.get(-1);
  const x = decoded.get(-2);
  const y = decoded.get(-3);
  if (kty !== 2) throw new Error("cose: kty must be 2");
  if (alg !== -7) throw new Error("cose: only ES256 supported");
  if (crv !== 1) throw new Error("cose: crv must be 1 (P-256)");
  if (!(x instanceof Uint8Array) || x.length !== 32) throw new Error("cose: bad x");
  if (!(y instanceof Uint8Array) || y.length !== 32) throw new Error("cose: bad y");
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64u(x),
      y: bytesToB64u(y),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}
export async function coseToJwkJson(coseBytes: Uint8Array): Promise<string> {
  const key = await importCoseEs256(coseBytes);
  const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
}
export async function importStoredJwkEs256(jwkJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkJson);
  return crypto.subtle.importKey(
    "jwk",
    { ...jwk, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}

// ── DER ECDSA → IEEE-P1363 ──────────────────────────────────────────────────
export function derToRawEcdsa(derBytes: Uint8Array): Uint8Array {
  if (!(derBytes instanceof Uint8Array)) throw new Error("der: not bytes");
  if (derBytes[0] !== 0x30) throw new Error("der: expected SEQUENCE");
  let pos = 1;
  if (derBytes[pos] & 0x80) pos += 1 + (derBytes[pos] & 0x7f);
  else pos += 1;
  if (derBytes[pos] !== 0x02) throw new Error("der: expected r INTEGER");
  pos += 1;
  const rLen = derBytes[pos];
  pos += 1;
  let r = derBytes.slice(pos, pos + rLen);
  pos += rLen;
  if (derBytes[pos] !== 0x02) throw new Error("der: expected s INTEGER");
  pos += 1;
  const sLen = derBytes[pos];
  pos += 1;
  let s = derBytes.slice(pos, pos + sLen);
  r = stripPad(r, 32);
  s = stripPad(s, 32);
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}
function stripPad(integer: Uint8Array, target: number): Uint8Array<ArrayBuffer> {
  let trimmed: Uint8Array = integer;
  while (trimmed.length > target && trimmed[0] === 0) trimmed = trimmed.slice(1);
  if (trimmed.length > target) throw new Error("der: integer overflow");
  const padded = new Uint8Array(new ArrayBuffer(target));
  padded.set(trimmed, target - trimmed.length);
  return padded;
}

// ── Hashing ─────────────────────────────────────────────────────────────────
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
export async function sha256Of(text: string): Promise<Uint8Array> {
  return sha256(new TextEncoder().encode(text));
}

// ── clientDataJSON ──────────────────────────────────────────────────────────
export function parseClientDataJson(b64u: string): { bytes: Uint8Array; parsed: Record<string, unknown> } {
  const bytes = b64uToBytes(b64u);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("clientDataJSON: not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("clientDataJSON: not an object");
  return { bytes, parsed: parsed as Record<string, unknown> };
}

// ── Verify ──────────────────────────────────────────────────────────────────
export async function verifyEs256(publicKey: CryptoKey, signatureDer: Uint8Array, signedBytes: Uint8Array): Promise<boolean> {
  const raw = derToRawEcdsa(signatureDer);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, raw, signedBytes);
}

// ── Challenges ──────────────────────────────────────────────────────────────
export function newChallenge(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToB64u(buf);
}

export function resolveRpAndOrigin(request: Request, env: { LAUNCHOPS_RP_ID?: string; LAUNCHOPS_RP_ORIGIN?: string }): { rpId: string; origin: string } {
  const url = new URL(request.url);
  const rpId = env?.LAUNCHOPS_RP_ID || url.hostname;
  const origin = env?.LAUNCHOPS_RP_ORIGIN || `${url.protocol}//${url.host}`;
  return { rpId, origin };
}
