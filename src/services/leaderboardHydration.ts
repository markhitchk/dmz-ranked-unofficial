import type { PublicLeaderboardSnapshot } from './leaderboardSnapshotCache';
import { MAX_HYDRATION_AGE_MS } from './leaderboardSnapshotCache';

/**
 * Restore a PREVIEW of previously rendered public standings into the real
 * website's #boardBody. It never replaces live rows, changes app scripts, or
 * uses external requests. All player strings use textContent, not innerHTML.
 *
 * The live website owns the leaderboard. Its next renderBoard() naturally
 * replaces this temporary table with current, fully interactive rows.
 */
export function buildLeaderboardHydrationScript(
  snapshot: PublicLeaderboardSnapshot | null
): string | null {
  if (!snapshot?.boardRows?.length) return null;
  const age = Date.now() - snapshot.capturedAt;
  if (age < 0 || age > MAX_HYDRATION_AGE_MS) return null;
  // The public data shown during loading must not survive a season switch.
  const payload = {
    capturedAt: snapshot.capturedAt,
    season: snapshot.season,
    rows: snapshot.boardRows.slice(0, 70)
  };
  return `
(function () {
  if (!/(^|\\.)dmzranked\\.com$/i.test(location.hostname)) return true;
  if (window.__dmzRnCacheRestoreInstalled) return true;
  window.__dmzRnCacheRestoreInstalled = true;
  var cache = ${JSON.stringify(payload)};
  var expiry = Date.now() + 5000;
  var watcher = null;
  function cleanSeason(text) {
    return String(text || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  }
  function restore() {
    if (Date.now() > expiry) return true;
    var board = document.getElementById('boardBody');
    if (!board) return false;
    if (board.querySelector('tbody tr[data-profile], [data-dmz-cached]')) return true;
    // The website's empty-board result is authoritative; don't overwrite it.
    if (board.querySelector('.empty')) return true;
    var liveSeason = document.querySelector(
      '#seasonBanner .season-title,#seasonBanner .sb-title,#seasonBar .season-name'
    );
    if (liveSeason && cache.season &&
        cleanSeason(liveSeason.textContent) !== cleanSeason(cache.season)) return true;
    if (!Array.isArray(cache.rows) || !cache.rows.length) return true;

    var shell = document.createElement('div');
    shell.setAttribute('data-dmz-cached', 'true');
    shell.className = 'dmz-cached-board';
    var notice = document.createElement('div');
    notice.className = 'dmz-cached-board-notice';
    notice.textContent = 'Last saved standings · syncing live results…';
    shell.appendChild(notice);
    var table = document.createElement('table');
    table.className = 'lb';
    var head = document.createElement('thead');
    var tr = document.createElement('tr');
    ['Operator', 'Rank', 'SR'].forEach(function(label) {
      var th = document.createElement('th');
      th.textContent = label;
      if (label === 'Rank') th.className = 'hide-sm';
      if (label === 'SR') th.className = 'num';
      tr.appendChild(th);
    });
    head.appendChild(tr);
    table.appendChild(head);
    var tbody = document.createElement('tbody');
    cache.rows.forEach(function(row) {
      if (!row || !row.name || !row.sr) return;
      var r = document.createElement('tr');
      // Cached rows cannot open live profiles before website data sync.
      r.className = 'dmz-cached-row';
      var op = document.createElement('td');
      op.className = 'op';
      var cell = document.createElement('div');
      cell.className = 'rankcell';
      var number = document.createElement('div');
      number.className = 'place';
      number.textContent = String(row.position || '');
      var wrap = document.createElement('div');
      var name = document.createElement('div');
      name.className = 'pname';
      name.textContent = String(row.name);
      var raids = document.createElement('div');
      raids.className = 'raids-mini';
      raids.textContent = String(row.raids || '');
      wrap.appendChild(name);
      wrap.appendChild(raids);
      cell.appendChild(number);
      cell.appendChild(wrap);
      op.appendChild(cell);
      var rank = document.createElement('td');
      rank.className = 'hide-sm';
      rank.textContent = String(row.rank || '');
      var sr = document.createElement('td');
      sr.className = 'num';
      sr.textContent = String(row.sr);
      r.appendChild(op);
      r.appendChild(rank);
      r.appendChild(sr);
      tbody.appendChild(r);
    });
    if (!tbody.childNodes.length) return true;
    table.appendChild(tbody);
    shell.appendChild(table);
    if (!board.childNodes.length) board.appendChild(shell);
    else return true;
    // Optional visual cue on snapshots; live website overwrites the body.
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'public-standings-cache-restored', count: tbody.childNodes.length
      }));
    } catch (_) {}
    return true;
  }
  function finish() {
    if (restore() || Date.now() > expiry) {
      if (watcher) watcher.disconnect();
      clearInterval(window.__dmzRnCacheRestorePoll);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finish, {once:true});
  }
  if (!restore() && typeof MutationObserver !== 'undefined') {
    watcher = new MutationObserver(finish);
    watcher.observe(document.documentElement, {childList:true,subtree:true});
    window.__dmzRnCacheRestorePoll = setInterval(finish, 250);
    setTimeout(function () {
      if (watcher) watcher.disconnect();
      clearInterval(window.__dmzRnCacheRestorePoll);
    }, 5200);
  }
})();
true;`;
}
