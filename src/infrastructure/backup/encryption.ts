import { z, type Infer } from "../../domain/shared/zod";

const encryptedBackupSchema = z.object({
  format: z.literal("erya-names-encrypted-backup"),
  schemaVersion: z.literal(1),
  kdf: z.object({
    name: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.number().int().min(100_000),
  }),
  cipher: z.object({ name: z.literal("AES-GCM") }),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
});

export type EncryptedBackup = Infer<typeof encryptedBackupSchema>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(
  plaintext: string,
  password: string,
  options: { randomBytes?: (length: number) => Uint8Array; iterations?: number } = {},
): Promise<EncryptedBackup> {
  if (!password) throw new Error("Backup password is required");
  const randomBytes =
    options.randomBytes ?? ((length: number) => crypto.getRandomValues(new Uint8Array(length)));
  const salt = new Uint8Array(randomBytes(16));
  const iv = new Uint8Array(randomBytes(12));
  const iterations = options.iterations ?? 310_000;
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    textEncoder.encode(plaintext),
  );

  return {
    format: "erya-names-encrypted-backup",
    schemaVersion: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations },
    cipher: { name: "AES-GCM" },
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptBackup(input: unknown, password: string): Promise<string> {
  const encrypted = encryptedBackupSchema.parse(input);
  const salt = decodeBase64(encrypted.salt);
  const iv = decodeBase64(encrypted.iv);
  const key = await deriveKey(password, salt, encrypted.kdf.iterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(decodeBase64(encrypted.ciphertext)),
  );
  return textDecoder.decode(plaintext);
}
