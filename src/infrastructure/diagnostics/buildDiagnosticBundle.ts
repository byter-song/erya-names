export function buildDiagnosticBundle(input: {
  appVersion: string;
  databaseVersion: number;
  errors: string[];
  counts: Record<string, number>;
}) {
  return {
    format: "erya-names-diagnostic",
    appVersion: input.appVersion,
    databaseVersion: input.databaseVersion,
    errors: [...input.errors],
    counts: { ...input.counts },
  };
}
