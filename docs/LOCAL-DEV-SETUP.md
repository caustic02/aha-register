# Local Android Development Setup

## Environment Verified (2026-03-25)

| Tool | Location | Status |
|------|----------|--------|
| `ANDROID_HOME` | `C:\Users\mitau\AppData\Local\Android\Sdk` | ✓ Set |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` | ✓ Set |
| Android SDK | build-tools 36.1.0, platform android-36.1 | ✓ Installed |
| AVD | `Medium_Phone_API_36.1` | ✓ Available |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` (161 MB) | ✓ Built |

> **Note:** EAS Build is for TestFlight/production releases only. All day-to-day development uses local builds via `npx expo run:android`.

---

## Prerequisites (one-time)

1. **Android Studio** installed with Android SDK (already done — SDK at `ANDROID_HOME`)
2. **ANDROID_HOME** must be in your PATH. If `adb` is not found in a fresh terminal, add to system env:
   ```
   ANDROID_HOME = C:\Users\mitau\AppData\Local\Android\Sdk
   PATH += %ANDROID_HOME%\platform-tools
   PATH += %ANDROID_HOME%\emulator
   ```
3. **`.env` file** must exist at repo root (copy `.env.example`, fill in Supabase values)

---

## Daily Development Workflow

### 1. Start the Android emulator

Open Android Studio → Device Manager → Start `Medium_Phone_API_36.1`

Or from terminal:
```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.1 &
```

Wait for the emulator to fully boot (home screen visible) before proceeding.

### 2. First-time build (or after native dependency changes)

Run this when you haven't built the app yet, or after adding/updating packages that contain native modules:

```bash
cd C:\ClaudeProject\aha-register
npx expo run:android
```

This will:
- Compile the Android native project with Gradle (~5–10 min first run, faster after)
- Install the `expo-dev-client` build on the running emulator
- Start the Metro bundler automatically
- Open the app on the emulator

> After the first successful `run:android`, the native app stays installed on the emulator. You only need to re-run this when native code changes (new packages, Gradle changes, etc.).

### 3. Subsequent sessions (JS-only changes)

If the dev client is already installed on the emulator:

```bash
npx expo start
```

Then press `a` to open on the Android emulator. Metro will bundle the JS and launch the app.

> Port 8081 is the default. If another Metro instance is already running, you'll be prompted to use 8082 — press `y`.

### 4. Hot Reload

Hot reload is automatic. Save any `.ts`/`.tsx` file in `src/` and Metro will update the app instantly without a full rebuild.

- **Fast Refresh** (default): preserves component state, reloads the changed module
- **Full reload**: shake the emulator → `Reload` — or press `r` in the Metro terminal

---

## Running on a Physical Android Device (USB)

1. On the Android device: **Settings → Developer Options → USB Debugging** (enable both)
2. Connect via USB cable
3. Verify device is recognized:
   ```bash
   $ANDROID_HOME/platform-tools/adb devices
   ```
   You should see your device listed (not `unauthorized`)
4. If `unauthorized`: on the device, accept the "Allow USB debugging" prompt
5. Build and run:
   ```bash
   npx expo run:android
   ```
   Expo will detect the connected device and install there. If both emulator and device are connected, it will prompt you to choose.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Port 8081 is in use` | Press `y` to use 8082, or kill the other Metro: `npx kill-port 8081` |
| `adb: command not found` | Add `$ANDROID_HOME/platform-tools` to PATH |
| `No emulators found` | Start emulator first (Android Studio → Device Manager) |
| Gradle build fails | Run `cd android && ./gradlew clean` then retry `npx expo run:android` |
| App shows "Unable to connect to Metro" | Ensure `npx expo start` is running; shake device → "Configure bundler" and set host to your machine's IP |
| Native modules not working after `npm install` | Re-run `npx expo run:android` (JS-only hot reload won't pick up new native code) |

---

## What EAS Build Is For

EAS Build is **not** used for development iteration. It is only for:
- **TestFlight distribution** (iOS production builds via EAS)
- **Google Play Store** releases (if/when applicable)
- Building on CI without a local Mac (iOS only)

For all Android development work, use `npx expo run:android` locally.
