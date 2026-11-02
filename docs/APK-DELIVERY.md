# Automatic APK delivery

The `Sync latest APK` GitHub Actions workflow checks Expo every 30 minutes for the
newest successful Android `preview` build. It downloads the APK, validates its ZIP,
package (`cc.rynni.studyapp`) and API URL, and calculates SHA-256. It keeps a
versioned APK and `studyapp-latest.apk`. It does not start additional Expo builds.

The workflow is initially disabled until its connection and credentials are set.
Set repository variable `APK_SYNC_ENABLED` to `true` to enable scheduled and manual
runs. Run it manually from GitHub's **Actions → Sync latest APK → Run workflow**.

## Run on the destination Linux server

Register a Linux GitHub Actions runner with the label `studyapp-apk`, running as
`rinne`. Set these repository variables:

| Variable | Value |
| --- | --- |
| `APK_SYNC_RUNNER` | `["self-hosted","Linux","studyapp-apk"]` |
| `APK_SYNC_OUTPUT_DIR` | `/home/rinne` |
| `APK_SSH_TARGET` | Leave unset (download directly on the server) |

Add repository secret `EXPO_TOKEN`, an Expo access token with access to the
`ivryn/thai-ai-study` project. Keep the runner running as a service. This mode
needs outbound HTTPS only, and remembers completed downloads in
`/home/rinne/apk-sync-state.json`.

Use a self-hosted runner only when its access is appropriate for the repository;
this repository is public. See [GitHub's runner guidance](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).

## Copy over SSH from a GitHub-hosted or LAN runner

Set `APK_SSH_TARGET` to `rinne@<reachable-host>` and optionally `APK_REMOTE_DIR`
(default `/home/rinne`). Add secrets `APK_SSH_KEY` (a dedicated SSH private key)
and `APK_SSH_KNOWN_HOSTS` (the verified server host-key entry). Put the matching
public key in the destination user's `~/.ssh/authorized_keys`.

The default runner is `ubuntu-latest`, which needs a publicly reachable SSH
endpoint or a configured private-network tunnel. It cannot connect directly to
`192.168.1.36`. For that address, select a Linux runner on the LAN using
`APK_SYNC_RUNNER`. Uploads use a staging file and verify the remote SHA-256 before
atomically updating the latest link. Passwords are not stored in the repository.

## Run manually on this Windows machine

This machine already has an authenticated EAS CLI. From `frontend`:

```powershell
$env:EAS_NO_VCS = '1'
eas build:list --platform android --status finished --build-profile preview --limit 10 --non-interactive --json |
  Set-Content -Encoding utf8 .expo/latest-builds.json
python ../tools/sync_latest_apk.py --build-json .expo/latest-builds.json --output-dir dist --ssh-target rinne@192.168.1.36
```

Without `--identity-file`, SSH uses the configured agent/default keys, or asks for
the account password. For unattended operation, configure a dedicated SSH key
and supply `--identity-file PATH`. Schedule these commands with Windows Task
Scheduler under the same user that is logged into Expo. The machine must remain
online and connected to the server's network.

Reference: [Expo GitHub Action](https://github.com/expo/expo-github-action).
