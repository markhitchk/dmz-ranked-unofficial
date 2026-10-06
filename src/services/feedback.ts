import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { gcm } from '@noble/ciphers/aes';
import { bytesToUtf8 } from '@noble/ciphers/utils';

const ENCRYPTED =
  'h6HIIbqrrYXcEugmtQAJWH/Z61UDBlydKpfuImU0fFIcwWnYDycYSPKXjK8IB/PPFcXg2J7oGz+IFLcx43mb7myUmCf+ukvlLdzl++SNA7L7AS1UMDvjlMWjFE1SwlLQhUD/vvQrylg732ZE/PdpeaRJRT/JBcgUhFyMwt/XheHNyYbrTuM1AQe1lAnmhT+28fS/LGg=';

const MASK = [
  184, 109, 228, 42, 152, 229, 51, 205, 162, 187, 26, 5, 6, 164, 53, 145,
  73, 216, 252, 205, 208, 48, 97, 243, 168, 178, 225, 117, 194, 115, 233, 95
];

const KEY_XOR = [
  211, 190, 254, 62, 140, 161, 250, 53, 215, 168, 65, 163, 78, 39, 151, 40,
  3, 41, 196, 211, 233, 104, 236, 85, 33, 55, 67, 81, 57, 130, 10, 4
];

const LAST_SEND_KEY = 'dmz_feedback_last_send_ms';
const SEND_COOLDOWN_MS = 30_000;

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const out: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(clean[i] ?? 'A');
    const c2 = BASE64_ALPHABET.indexOf(clean[i + 1] ?? 'A');
    const c3 =
      clean[i + 2] === '='
        ? -1
        : BASE64_ALPHABET.indexOf(clean[i + 2] ?? 'A');
    const c4 =
      clean[i + 3] === '='
        ? -1
        : BASE64_ALPHABET.indexOf(clean[i + 3] ?? 'A');

    out.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0) out.push(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 >= 0 && c3 >= 0) out.push(((c3 & 3) << 6) | c4);
  }

  return new Uint8Array(out);
}

function webhookUrl(): string {
  const key = new Uint8Array(32);
  for (let i = 0; i < key.length; i += 1) {
    key[i] = (MASK[i] ?? 0) ^ (KEY_XOR[i] ?? 0);
  }

  const packed = base64ToBytes(ENCRYPTED);
  const nonce = packed.slice(0, 12);
  const ciphertextAndTag = packed.slice(12);
  const plaintext = gcm(key, nonce).decrypt(ciphertextAndTag);
  key.fill(0);
  return bytesToUtf8(plaintext);
}

function truncate(value: string, max: number): string {
  const clean = value.trim();
  return clean.length <= max ? clean : clean.slice(0, Math.max(0, max - 1)) + '…';
}

export type FeedbackPayload = {
  category: string;
  subject: string;
  details: string;
  contact: string;
};

export async function feedbackCooldownSeconds(): Promise<number> {
  const last = Number((await AsyncStorage.getItem(LAST_SEND_KEY)) ?? 0);
  const remaining = SEND_COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? Math.max(1, Math.ceil(remaining / 1000)) : 0;
}

export async function sendFeedback(
  payload: FeedbackPayload
): Promise<{ ok: boolean; reportId: string; error?: string }> {
  const seconds = await feedbackCooldownSeconds();
  if (seconds > 0) {
    return {
      ok: false,
      reportId: '',
      error: `Please wait ${seconds} seconds before sending another report.`
    };
  }

  const reportId = Crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const version = Application.nativeApplicationVersion ?? 'Unknown';
  const build = Application.nativeBuildVersion ?? 'Unknown';
  const packageName = Application.applicationId ?? 'unknown';
  const device = [
    Device.manufacturer ?? '',
    Device.modelName ?? Device.deviceName ?? 'Unknown device',
    Device.osName ?? 'Android',
    Device.osVersion ?? String(Device.platformApiLevel ?? '')
  ]
    .filter(Boolean)
    .join(' • ');

  const json = {
    username: 'DMZ Ranked • App Feedback',
    allowed_mentions: { parse: [] },
    attachments: [
      {
        id: 0,
        filename: 'dmz-ranked-logo.png',
        description: 'DMZ Ranked app logo'
      }
    ],
    embeds: [
      {
        author: { name: 'DMZ Ranked • Android App Feedback' },
        title: truncate(payload.subject, 180),
        description: truncate(payload.details, 3500),
        color: 16172115,
        thumbnail: { url: 'attachment://dmz-ranked-logo.png' },
        fields: [
          { name: 'Report ID', value: `\`\`${reportId}\`\``, inline: true },
          { name: 'Type', value: payload.category, inline: true },
          { name: 'Scope', value: 'Android app only', inline: true },
          { name: 'App Version', value: `${version} (${build})`, inline: true },
          { name: 'Package', value: `\`\`${packageName}\`\``, inline: true },
          {
            name: 'Contact',
            value: payload.contact.trim()
              ? truncate(payload.contact, 300)
              : 'Not provided',
            inline: true
          },
          { name: 'Device / OS', value: device, inline: false },
          {
            name: 'Routing',
            value:
              "App bugs and app features → Harley's Studios\nWebsite/server issues → Main DMZ Ranked Discord",
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Harley's Studios • App-only feedback • ${reportId}`
        }
      }
    ]
  };

  try {
    const asset = Asset.fromModule(require('../../assets/dmz_ranked_logo.png'));
    await asset.downloadAsync();

    const form = new FormData();
    form.append('payload_json', JSON.stringify(json));
    form.append(
      'files[0]',
      {
        uri: asset.localUri ?? asset.uri,
        name: 'dmz-ranked-logo.png',
        type: 'image/png'
      } as any
    );

    const response = await fetch(webhookUrl(), {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error(`Discord returned HTTP ${response.status}`);
    }

    await AsyncStorage.setItem(LAST_SEND_KEY, String(Date.now()));
    return { ok: true, reportId };
  } catch (error) {
    return {
      ok: false,
      reportId,
      error:
        error instanceof Error
          ? error.message
          : 'Could not send feedback.'
    };
  }
}
