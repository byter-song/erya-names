import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const requiredDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "worker-src 'none'",
];
const forbiddenPatterns = [
  /(?:fetch|sendBeacon|WebSocket)\s*\(\s*["'`]https?:\/\/(?!127\.0\.0\.1|localhost)/i,
  /(?:src|href)=["']https?:\/\/(?!127\.0\.0\.1|localhost)/i,
  /(?:url|@import)\s*\(?\s*["']?https?:\/\/(?!127\.0\.0\.1|localhost)/i,
  /navigator\.serviceWorker|serviceWorker\.register/i,
  /google-analytics|googletagmanager|segment\.com|sentry\.io/i,
  /(?:api[_-]?key|secret|private[_-]?key)\s*[:=]\s*["'][^"']{12,}/i,
];

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

export async function auditSecurity(root = process.cwd()) {
  const headers = await readFile(path.join(root, "public", "_headers"), "utf8");
  const errors = requiredDirectives
    .filter((directive) => !headers.includes(directive))
    .map((directive) => `missing-csp-directive:${directive}`);
  if (!headers.includes("Strict-Transport-Security: max-age=63072000"))
    errors.push("missing-hsts");

  const dist = path.join(root, "dist");
  for (const file of await filesUnder(dist)) {
    if (!/\.(?:html|js|css|json|txt)$/.test(file)) continue;
    const content = await readFile(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content))
        errors.push(`forbidden:${path.relative(root, file)}:${pattern}`);
    }
  }
  const report = { ok: errors.length === 0, checkedAt: new Date().toISOString(), errors };
  const output = path.join(root, "output", "security");
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "security-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const report = await auditSecurity();
if (!report.ok) {
  process.stderr.write(`${report.errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Security audit passed.\n");
}
