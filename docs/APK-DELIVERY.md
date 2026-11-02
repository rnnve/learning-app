# Automatic APK delivery

The `Sync latest APK` GitHub Actions workflow checks Expo every 30 minutes for the
newest successful Android `preview` build. It downloads the APK, validates its ZIP,
package (`cc.rynni.studyapp`) and API URL, and calculates SHA-256 before uploading
the file to `https://cdn.rynni.cc/upload` under `/apks/`.

The CDN uses a multipart field named `file`, with `key` and `path` query
parameters. The upload key is passed to curl over stdin, never included in its
command arguments. CDN-assigned filenames are random: the workflow preserves the
file path on the public CDN hostname in its job summary and `latest-apk-details`
artifact. The uploaded file is downloaded again and its SHA-256 checked before
delivery is marked complete.
An Actions cache remembers successful deliveries so scheduled runs do not upload
the same Expo build repeatedly. Failed uploads are not marked as delivered.

## GitHub configuration

Use standard GitHub-hosted Linux runners. No LAN access or SSH credentials are
needed for CDN delivery. Configure these repository secrets:

| Secret | Purpose |
| --- | --- |
| `EXPO_TOKEN` | Access to the `ivryn/thai-ai-study` Expo project |
| `CDN_UPLOAD_KEY` | Authentication for the CDN upload endpoint |

Set repository variable `APK_SYNC_ENABLED` to `true` to enable the workflow.
Optionally set `CDN_UPLOAD_URL` to override the upload endpoint and
`CDN_PUBLIC_BASE_URL` to override the public origin (default `https://cdn.rynni.cc`). Uploads always
use `/apks/`. The uploader rejects APKs larger than 100,000,000 bytes before
attempting the request, matching the current upload constraint.

Run manually from **Actions → Sync latest APK → Run workflow**. The workflow
syncs existing builds; it does not start additional Expo builds.

## APK size

The `preview` EAS profile builds both `armeabi-v7a` and `arm64-v8a` for Android
phones. It excludes x86/x86-64 libraries used by Intel devices and emulators,
and enables R8 minification and resource shrinking. The `universal` profile
includes all four architectures when needed, but its APK may exceed the CDN
upload limit. The package and signing key remain the same.

## Run manually on this Windows machine

From `frontend`, using an authenticated EAS CLI and Python 3.11 or newer:

```powershell
$env:EAS_NO_VCS = '1'
eas build:list --platform android --status finished --build-profile preview --limit 10 --non-interactive --json |
  Set-Content -Encoding utf8 .expo/latest-builds.json
# Set CDN_UPLOAD_KEY in the process environment before running:
python ../tools/sync_latest_apk.py --build-json .expo/latest-builds.json --output-dir dist --cdn-url https://cdn.rynni.cc/upload --cdn-path /apks/
```

The script also supports `--ssh-target rinne@192.168.1.36` instead of
`--cdn-url` for manual LAN delivery. Supply `--identity-file PATH` for unattended
SSH delivery. CDN and SSH destinations are mutually exclusive.

References: [Expo GitHub Action](https://github.com/expo/expo-github-action),
[EAS build configuration](https://docs.expo.dev/eas/json/).
