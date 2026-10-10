# Beta 186 native UI regression recovery

Beta 185's wide native animation rollout caused a user-reported UI/layout regression.
Because the affected screen is not identified, this recovery restores the complete
Beta 184 native view implementations rather than making speculative partial changes.

Restored files: App, AppHeader, SettingsPanel, DmzDialog, AppMessagesPanel,
FeedbackPanel, LoadingOverlay, and DmzWebScreen. Removed unused Beta 185 motion
modules and motion-only unit tests. New UI parity regression tests guard against
reintroducing the bulk substitution and Settings list wrapping.

All unrelated features stay intact, including dynamic welcome notifications,
non-deletable local notification History, and the remote app interface. The stable
version remains unchanged. Beta build/versionCode advances to 186.

Run TypeScript, unit tests, Expo doctor, release compilation and APK signature
and alignment verification before providing the new APK. Android 16 Samsung A17
device visual smoothness and the original reported symptom still need real-device
verification. This release prioritizes recovering the Beta 184 layout; the Beta
185 animation redesign remains reverted.
