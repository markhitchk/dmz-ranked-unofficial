// Every navigation invalidates pending fetches, messages, and fade callbacks.
export class AppUiLoadGate {
  private revision = 0;
  private documentLoaded = false;
  private uiReady = false;
  private failed = false;
  private completing = false;

  begin(requiresOverrides: boolean): number {
    this.revision += 1;
    this.documentLoaded = false;
    this.uiReady = !requiresOverrides;
    this.failed = false;
    this.completing = false;
    return this.revision;
  }

  isCurrent(id: number): boolean {
    return id === this.revision && !this.failed;
  }

  loaded(id: number): void {
    if (this.isCurrent(id)) this.documentLoaded = true;
  }

  verified(id: number): void {
    if (this.isCurrent(id)) this.uiReady = true;
  }

  claimReady(id: number): boolean {
    if (!this.isCurrent(id) || !this.documentLoaded || !this.uiReady || this.completing) return false;
    this.completing = true;
    return true;
  }

  fail(id: number): void {
    if (id === this.revision) this.failed = true;
  }

  cancel(): void {
    this.revision += 1;
    this.failed = true;
  }
}
