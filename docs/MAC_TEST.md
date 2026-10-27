# Mac test build (Apple Silicon)

Files (in /workspace/dist-parts):
- tempo-mac-arm64-v1.zip.part00 … part04: 25 MB parts.
- MD5SUMS-tempo-mac-arm64-v1.txt: checksums.

```sh
cat tempo-mac-arm64-v1.zip.part* > tempo-mac-arm64-v1.zip
md5 tempo-mac-arm64-v1.zip              # must match MD5SUMS-tempo-mac-arm64-v1.txt
ditto -x -k tempo-mac-arm64-v1.zip .    # keeps the framework symlinks
xattr -dr com.apple.quarantine Tempo.app
open Tempo.app                          # or right-click → Open (ad-hoc signed, not notarised)
```

Try:
- The window sizes itself to the screen. Press `C` to create an event and drag on the grid. `⌘K` opens commands, `?` shows shortcuts, `⌘,` opens settings, and `S` enters availability mode.
- **Menu bar.** The tray title shows the next event. Press ⌃⌘K to pop the menu and ⌃⌘J to join the next call.
- **Reminders.** Create an event 11 minutes ahead (the default reminder is 10 min). A card appears top-right along with a notification.
- **Files and links.** Double-click a `.ics` file, or run `open "tempo://day/2026-11-03"` in Terminal.
- **Data.** Stored in `~/Library/Application Support/Tempo/tempo.db` (SQLite).
