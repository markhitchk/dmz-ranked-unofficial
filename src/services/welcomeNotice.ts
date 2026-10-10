import type { AppChannel } from '../types';

export type WelcomeNotice = {
  id: string;
  title: string;
  body: string;
  priority: 'info';
};

type WelcomeDetails = {
  channel: AppChannel;
  version: string;
  build: string;
  operatorName?: string | null;
};

function cleanDisplay(value: unknown, limit: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
  return text || fallback;
}

/** Builds a local system notice using the actual installed native version. */
export function buildWelcomeNotice(details: WelcomeDetails): WelcomeNotice {
  const channel = details.channel === 'beta' ? 'beta' : 'stable';
  const version = cleanDisplay(details.version, 28, 'unknown');
  const build = cleanDisplay(details.build, 28, 'unknown');
  const name = cleanDisplay(details.operatorName, 48, 'Guest').replace(/^@+/, '') || 'Guest';
  const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
  const id = `welcome_${channel}_${safeId(version)}_${safeId(build)}`;
  const appName = 'DMZ Ranked';

  if (channel === 'beta') {
    return {
      id,
      title: '[System] Welcome to DMZ Ranked BETA',
      body: `Welcome, @${name}! 🎮

You're running ${appName} [BETA] • v${version} (Build ${build}).

🧪 BETA ACCESS
You're getting an early look at experimental features. Some features are Beta-only and may change, be removed, or never appear in the Stable release.

🔔 Check the bell for system notices, operator activity, updates, and messages from Harley's Studios.

Thanks for helping improve DMZ Ranked!
— Harley's Studios`,
      priority: 'info'
    };
  }

  return {
    id,
    title: '[System] Welcome to DMZ Ranked',
    body: `Welcome, @${name}! 🎮

You're running ${appName} • v${version} (Build ${build}) — STABLE.

✅ Ready to deploy? You're on the Stable release, designed for a dependable everyday experience.

🔔 Visit the bell for important system notices, operator reports, app updates, and messages from Harley's Studios.

Good luck out there, Operator!
— Harley's Studios`,
    priority: 'info'
  };
}
