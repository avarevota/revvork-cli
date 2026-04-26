export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

export function printJsonError(err: { code: number; message: string; details?: unknown }): void {
  process.stderr.write(JSON.stringify({ error: err }, null, 2) + '\n');
}
