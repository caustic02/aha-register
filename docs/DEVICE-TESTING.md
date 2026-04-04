# Physical Device Testing with scrcpy

## Prerequisites (installed via scoop)

```bash
scoop install main/adb      # ADB v36.0.2 (clean, no Android Studio conflicts)
scoop install main/scrcpy   # scrcpy v3.3.4 (screen mirror + control)
```

Scoop ADB is at `~/scoop/shims/adb.exe` and takes priority over Android Studio's copy.

## Phone Setup (one-time)

1. **Enable Developer Options:** Settings > About Phone > tap Build Number 7 times
2. **Enable USB Debugging:** Settings > Developer Options > USB Debugging ON
3. **Connect USB** and tap "Allow" on the authorization popup (check "Always allow")

## Daily Workflow

```bash
# 1. Verify device connection
adb devices          # Should show your device serial + "device" (not "unauthorized")

# 2. Install the debug APK (already built)
adb install android/app/build/outputs/apk/debug/app-debug.apk
# If fails: adb uninstall com.tedeholdings.aharegister && retry

# 3. Start Metro bundler
bunx expo start       # or: npx expo start

# 4. Open the app on device
adb shell am start -a android.intent.action.VIEW \
  -d "exp+aha-register://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.tedeholdings.aharegister

# 5. Mirror phone screen to PC
scrcpy --window-title "aha! Register Testing"
```

## scrcpy Controls

| Action | Control |
|--------|---------|
| Tap | Left click |
| Swipe | Click + drag |
| Back | Right click or Backspace |
| Home | Middle click or H |
| Recent apps | - |
| Volume | Ctrl+Up / Ctrl+Down |
| Power | Ctrl+P |
| Rotate | Ctrl+R |
| Fullscreen | Ctrl+F |
| Copy text to PC | Ctrl+C on device selection |

## Rebuilding After Native Changes

Only needed when native dependencies change (new packages, Gradle config):

```bash
bunx expo run:android    # Full native build + install
```

For JS-only changes, Metro hot reload handles it automatically.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `unauthorized` | Revoke USB auth in Developer Options, unplug/replug, tap Allow |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | `adb uninstall com.tedeholdings.aharegister` then reinstall |
| `Unable to connect to Metro` | Check `adb reverse tcp:8081 tcp:8081` is set |
| scrcpy black screen | Try `scrcpy --render-driver=software` |
| Multiple ADB versions | Ensure scoop ADB is first: `where adb` should show `~/scoop/shims/adb.exe` first |

## Notes

- EAS Build is for TestFlight/production only. All dev testing uses local builds.
- The emulator has display cutout differences vs real devices. Always test safe area on physical hardware.
- `SafeAreaView` uses `react-native-safe-area-context` (not the deprecated `react-native` version) for proper cutout handling.
