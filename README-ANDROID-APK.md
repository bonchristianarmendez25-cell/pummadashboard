# PUMMA Dashboard → Android APK (auto-built by GitHub)

This wraps your existing dashboard (the same `index.html` that's deployed on
Vercel) into an installable Android app, using Capacitor. You don't need to
install Android Studio, Java, or anything else on your own computer — GitHub
builds the `.apk` for you in the cloud every time you push.

## 1. One-time setup (5 minutes)

1. Copy these files into the **root** of your `pummadashboard` repo, keeping
   the same folder structure:
   - `package.json`
   - `capacitor.config.json`
   - `.github/workflows/build-android-apk.yml`
2. Open your existing `.gitignore` and add the three lines from
   `gitignore-additions.txt` to the bottom of it (or create a `.gitignore`
   if you don't have one yet).
3. Commit and push:
   ```
   git add .
   git commit -m "Add Android app build"
   git push
   ```

That's it. Nothing about your website or Vercel deployment changes — these
files are only used by the Android build, your site keeps working exactly
as before.

## 2. Getting the APK

After you push, GitHub starts building automatically. To watch it / get the file:

1. Go to your repo on GitHub → the **Actions** tab.
2. Click the most recent run of "Build Android APK" (takes roughly 5–10 minutes).
3. Once it finishes with a green check, scroll down to **Artifacts** and
   click **pumma-dashboard-debug-apk** to download a zip.
4. Unzip it — inside is `app-debug.apk`. That's the installable app.

You can also trigger a build manually anytime without pushing a new commit:
Actions tab → "Build Android APK" → **Run workflow** button.

### Optional: a permanent download link instead of digging through Actions

If you'd rather have one stable link to share (instead of hunting through
the Actions tab each time), tag a release:
```
git tag v1.0.0
git push origin v1.0.0
```
This automatically attaches the APK to a GitHub Release, which gets you a
permanent URL under your repo's **Releases** section.

## 3. Installing it on a phone

1. Transfer `app-debug.apk` to the phone (Google Drive, USB cable, email to
   yourself, anything works).
2. Tap the file. Android will warn about installing from an unknown
   source — tap **Settings**, allow installs from that source, then go back
   and tap Install. (Wording varies slightly by Android version.)
3. The app installs and works exactly like the website — same login, same
   data, same everything, because it's the same `index.html`. The app
   still needs an internet connection to reach Firebase, same as the site.

**If a reinstall ever fails with a signature/conflict error:** uninstall the
old version first, then install the new one. This happens because debug
builds are signed with a build-time key that isn't guaranteed to be
identical between separate workflow runs — it's a normal quirk of unsigned
debug APKs, not a bug in the app.

## Notes / things you may want later

- **App icon**: until you provide your own, the app uses Capacitor's plain
  default icon. To use your real logo, drop a 1024×1024 PNG into a
  `resources/icon.png` file and run `npx @capacitor/assets generate` — happy
  to wire this up once you have the image ready.
- **App ID**: currently set to `ph.edu.pumma.dashboard` in
  `capacitor.config.json`. You can change this before your first real
  release if you'd prefer something else; just know that changing it later
  makes Android treat it as a completely different app (existing installs
  won't auto-update).
- This produces a **debug** APK, which is correct for sharing directly the
  way you described (no Play Store). If you ever do want to publish to the
  Play Store later, that requires a proper release signing key — a
  different, slightly more involved step I can help with when you get there.
