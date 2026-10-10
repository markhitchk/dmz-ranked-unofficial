export type DialogPhase = 'hidden' | 'entering' | 'shown' | 'exiting';
export type DialogEvent = 'open' | 'entered' | 'close' | 'exited';
export function nextDialogPhase(phase: DialogPhase, event: DialogEvent): DialogPhase {
  if (event === 'open') return 'entering';
  if (event === 'close') return phase === 'hidden' ? 'hidden' : 'exiting';
  if (event === 'entered') return phase === 'entering' ? 'shown' : phase;
  if (event === 'exited') return phase === 'exiting' ? 'hidden' : phase;
  return phase;
}
