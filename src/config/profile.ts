import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Profile = { baseUrl: string; token?: string; email?: string };
export type Config = { currentProfile: string; profiles: Record<string, Profile> };

function configDir(): string {
  return process.env.REVVORK_CONFIG_DIR ?? join(homedir(), '.config', 'revvork');
}
function configPath(): string {
  return join(configDir(), 'config.json');
}

export function loadConfig(): Config {
  const p = configPath();
  if (!existsSync(p)) return { currentProfile: 'default', profiles: {} };
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<Config>;
    return {
      currentProfile: raw.currentProfile ?? 'default',
      profiles: raw.profiles ?? {},
    };
  } catch {
    return { currentProfile: 'default', profiles: {} };
  }
}

export function writeConfig(cfg: Config): void {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2));
  try { chmodSync(p, 0o600); } catch { /* windows */ }
}

export function saveProfile(name: string, profile: Profile): void {
  const cfg = loadConfig();
  cfg.profiles[name] = profile;
  if (!cfg.currentProfile) cfg.currentProfile = name;
  writeConfig(cfg);
}

export function setActiveProfile(name: string): void {
  const cfg = loadConfig();
  if (!cfg.profiles[name]) throw new Error(`Profile not found: ${name}`);
  cfg.currentProfile = name;
  writeConfig(cfg);
}

export function getActiveProfile(profileOverride?: string): Profile | undefined {
  const cfg = loadConfig();
  const name = profileOverride ?? cfg.currentProfile;
  return cfg.profiles[name];
}

export function clearProfileToken(name: string): void {
  const cfg = loadConfig();
  if (cfg.profiles[name]) {
    delete cfg.profiles[name].token;
    writeConfig(cfg);
  }
}
