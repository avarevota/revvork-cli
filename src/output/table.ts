import Table from 'cli-table3';
import pc from 'picocolors';

export function printTable(headers: string[], rows: (string | number | null | undefined)[][]): void {
  const t = new Table({
    head: headers.map((h) => pc.bold(h)),
    style: { head: [], border: [] },
  });
  for (const r of rows) t.push(r.map((c) => (c == null ? pc.gray('—') : String(c))));
  process.stdout.write(t.toString() + '\n');
}

export function info(msg: string): void {
  process.stdout.write(msg + '\n');
}
export function success(msg: string): void {
  process.stdout.write(pc.green('✓ ') + msg + '\n');
}
export function warn(msg: string): void {
  process.stderr.write(pc.yellow(msg) + '\n');
}
export function fail(msg: string): void {
  process.stderr.write(pc.red('✗ ') + msg + '\n');
}
