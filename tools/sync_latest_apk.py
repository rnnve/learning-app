"""Download a finished EAS APK, verify it, and deliver it to the CDN or SSH."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


PACKAGE = "cc.rynni.studyapp"
API_URL = "https://learning-app-api.rynni.cc"


def select_build(data):
    builds = data if isinstance(data, list) else [data]
    for build in builds:
        if build.get("status") != "FINISHED" or build.get("platform") != "ANDROID":
            continue
        # Some EAS CLI versions omit appIdentifier. The downloaded manifest is
        # always checked before a file is installed or delivered.
        if build.get("appIdentifier") not in (None, PACKAGE):
            continue
        url = build.get("artifacts", {}).get("buildUrl") or build.get("artifacts", {}).get("applicationArchiveUrl")
        if not url or urlparse(url).scheme != "https":
            continue
        version = str(build.get("appVersion", ""))
        code = str(build.get("appBuildVersion", ""))
        if not re.fullmatch(r"\d+(?:\.\d+){1,3}", version) or not code.isdigit():
            raise ValueError("Build must have a numeric app version and Android version code")
        return build, url, f"studyapp-{version}-{code}.apk"
    raise ValueError(f"No finished Android APK found for {PACKAGE}")


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def atomic_json(path, data):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def deploy(apk, digest, target, directory, identity, known_hosts):
    if target.startswith("-") or not re.fullmatch(r"[A-Za-z0-9_.@-]+", target):
        raise ValueError("SSH target must be a hostname or user@hostname")
    if not re.fullmatch(r"/[A-Za-z0-9_./-]+", directory) or ".." in directory.split("/"):
        raise ValueError("Remote directory must be an absolute path without spaces or '..'")
    options = ["-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=15"]
    if identity:
        options += ["-i", str(identity), "-o", "BatchMode=yes"]
    if known_hosts:
        options += ["-o", f"UserKnownHostsFile={known_hosts}"]
    remote_apk = f"{directory.rstrip('/')}/{apk.name}"
    staging = remote_apk + ".upload"
    latest = f"{directory.rstrip('/')}/studyapp-latest.apk"
    subprocess.run(["ssh", *options, target, f"mkdir -p -- {shlex.quote(directory)}"], check=True)
    subprocess.run(["scp", *options, str(apk), f"{target}:{staging}"], check=True)
    # Never replace the current APK until the transferred file passes its hash check.
    command = (
        f"set -eu; printf '%s  %s\\n' {shlex.quote(digest)} {shlex.quote(staging)} | sha256sum -c -; "
        f"mv -f -- {shlex.quote(staging)} {shlex.quote(remote_apk)}; "
        f"ln -sfn -- {shlex.quote(apk.name)} {shlex.quote(latest + '.tmp')}; "
        f"mv -Tf -- {shlex.quote(latest + '.tmp')} {shlex.quote(latest)}"
    )
    subprocess.run(["ssh", *options, target, command], check=True)
    print(f"Delivered to {target}:{remote_apk}")


def upload_cdn(apk, endpoint, directory):
    key = os.environ.get("CDN_UPLOAD_KEY", "").strip()
    if not key:
        raise ValueError("Set CDN_UPLOAD_KEY before uploading")
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("CDN endpoint must use HTTPS without credentials in the URL")
    query = dict(parse_qsl(parsed.query))
    query.update(key=key, path=directory)
    url = urlunparse(parsed._replace(query=urlencode(query), fragment=""))
    # Pass the authenticated URL on stdin, so process listings and logs never
    # contain the key. curl streams the multipart body instead of buffering it.
    command = ["curl.exe" if os.name == "nt" else "curl", "--disable"]
    if os.name == "nt":
        command += ["--ssl-revoke-best-effort"]
    with tempfile.TemporaryDirectory(prefix="cdn-response-") as temporary:
        response_file = Path(temporary) / "response.json"
        command += [
            "--silent", "--show-error", "--fail-with-body", "--connect-timeout", "30",
            "--max-time", "600", "--config", "-", "--form",
            f'file=@"{apk.resolve()}";filename="{apk.name}"',
            "--output", str(response_file), "--write-out", "%{http_code}",
        ]
        result = subprocess.run(command, input=f"url = {json.dumps(url)}\n", capture_output=True, text=True)
        status = result.stdout.strip()
        if result.returncode or not status.startswith("2"):
            if status == "413":
                raise RuntimeError("CDN rejected the APK with HTTP 413: file exceeds the upload limit")
            raise RuntimeError(f"CDN upload failed (HTTP {status or 'unknown'}, curl exit {result.returncode})")
        data = json.loads(response_file.read_text(encoding="utf-8"))
        public_url = data.get("url", "")
        if urlparse(public_url).scheme != "https":
            raise ValueError("CDN did not return an HTTPS download URL")
        if data.get("size") != apk.stat().st_size:
            raise ValueError("CDN reported a different uploaded file size")
        request = Request(public_url, headers={"User-Agent": "Mozilla/5.0 StudyApp-APK-Sync/1.0"})
        digest = hashlib.sha256()
        with urlopen(request, timeout=120) as downloaded:
            while chunk := downloaded.read(1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != sha256(apk):
            raise ValueError("CDN download SHA-256 does not match the uploaded APK")
        return public_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-json", type=Path, required=True, help="JSON from eas build:list or build:view")
    parser.add_argument("--output-dir", type=Path, required=True)
    delivery = parser.add_mutually_exclusive_group()
    delivery.add_argument("--ssh-target", help="Optional SSH destination, e.g. rinne@192.168.1.36")
    delivery.add_argument("--cdn-url", help="CDN multipart upload endpoint (key comes from CDN_UPLOAD_KEY)")
    parser.add_argument("--cdn-path", default="/apks/")
    parser.add_argument("--max-upload-bytes", type=int, default=100_000_000)
    parser.add_argument("--remote-dir", default="/home/rinne")
    parser.add_argument("--identity-file", type=Path)
    parser.add_argument("--known-hosts-file", type=Path)
    args = parser.parse_args()
    build, url, filename = select_build(json.loads(args.build_json.read_text(encoding="utf-8-sig")))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    apk = args.output_dir / filename
    state_path = args.output_dir / "apk-sync-state.json"
    destination = f"{args.ssh_target}:{args.remote_dir}" if args.ssh_target else str(args.output_dir.resolve())
    if args.cdn_url:
        destination = f"cdn:{args.cdn_url}:{args.cdn_path}"
        if not os.environ.get("CDN_UPLOAD_KEY", "").strip():
            raise ValueError("Set CDN_UPLOAD_KEY before uploading")
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if args.cdn_url and state.get("buildId") == build["id"] and state.get("destination") == destination and state.get("cdnUrl"):
        print(f"Already delivered: {state['cdnUrl']}")
        return
    if state.get("buildId") == build["id"] and state.get("destination") == destination and apk.exists():
        if sha256(apk) == state.get("sha256"):
            print(f"Already delivered build {build['id']}")
            return
    if int(state.get("versionCode", 0)) > int(build["appBuildVersion"]):
        raise ValueError("Refusing to replace a newer Android build with an older build")
    with tempfile.TemporaryDirectory(prefix="apk-sync-", dir=args.output_dir) as temporary:
        download = Path(temporary) / filename
        print(f"Downloading {filename}", flush=True)
        request = Request(url, headers={"User-Agent": "Mozilla/5.0 StudyApp-APK-Sync/1.0"})
        with urlopen(request, timeout=120) as response, download.open("wb") as output:
            shutil.copyfileobj(response, output)
        subprocess.run([
            sys.executable, str(Path(__file__).with_name("verify_apk.py")), str(download),
            "--package", PACKAGE, "--api-url", API_URL,
        ], check=True)
        digest = sha256(download)
        os.replace(download, apk)
        cdn_url = None
        if args.cdn_url:
            if apk.stat().st_size > args.max_upload_bytes:
                raise ValueError(f"APK is larger than the {args.max_upload_bytes:,}-byte CDN upload limit")
            cdn_url = upload_cdn(apk, args.cdn_url, args.cdn_path)
            print(f"CDN download: {cdn_url}")
        if args.ssh_target:
            deploy(apk, digest, args.ssh_target, args.remote_dir, args.identity_file, args.known_hosts_file)
        latest = args.output_dir / "studyapp-latest.apk"
        latest_temporary = Path(temporary) / "latest.apk"
        shutil.copyfile(apk, latest_temporary)
        os.replace(latest_temporary, latest)
    atomic_json(state_path, {
        "buildId": build["id"], "version": build["appVersion"],
        "versionCode": build["appBuildVersion"], "sha256": digest,
        "filename": filename, "destination": destination,
        "cdnUrl": cdn_url,
    })
    print(f"Ready: {apk}")


if __name__ == "__main__":
    main()
