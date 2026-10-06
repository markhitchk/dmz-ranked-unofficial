import type { BridgeMessage } from '../types';

export function createBridgeBootstrap(channel: string): string {
  const channelLiteral = JSON.stringify(channel);

  return [
    '(function () {',
    '  if (window.__DMZ_RN_BRIDGE__) return true;',
    '  window.__DMZ_RN_BRIDGE__ = true;',
    '  function send(payload) {',
    '    try {',
    '      window.ReactNativeWebView.postMessage(JSON.stringify(payload));',
    '    } catch (_) {}',
    '  }',
    '  window.HarleysStudiosApp = {',
    '    channel: ' + channelLiteral + ',',
    "    notify: function (title, body) { send({ type: 'notification', title: String(title || ''), body: String(body || '') }); },",
    "    setOperator: function (name, verified) { send({ type: 'operator', name: String(name || ''), verified: !!verified }); },",
    "    openSettings: function () { send({ type: 'open-settings' }); },",
    "    log: function (message) { send({ type: 'log', message: String(message || '') }); }",
    '  };',
    "  window.addEventListener('dmz-ranked-notification', function (event) {",
    '    var detail = event && event.detail ? event.detail : {};',
    "    send({ type: 'notification', title: detail.title || 'DMZ Ranked', body: detail.body || '' });",
    '  });',
    "  window.addEventListener('dmz-ranked-operator', function (event) {",
    '    var detail = event && event.detail ? event.detail : {};',
    "    send({ type: 'operator', name: detail.name || '', verified: !!detail.verified });",
    '  });',
    "  send({ type: 'ready' });",
    '  return true;',
    '})();',
    'true;'
  ].join('\n');
}

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const parsed = JSON.parse(raw) as BridgeMessage;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
