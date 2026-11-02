"""Verify an APK's package, embedded API URL, and ZIP integrity without an Android SDK."""
import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import zipfile
from pathlib import Path


def verify_android_tools(apk, expected_certificate):
    configured = os.environ.get("ANDROID_BUILD_TOOLS")
    if configured:
        tools = Path(configured)
    else:
        sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
        if not sdk:
            raise ValueError("Set ANDROID_HOME or ANDROID_BUILD_TOOLS for Android signature checks")
        candidates = list((Path(sdk) / "build-tools").glob("*/lib/apksigner.jar"))
        if not candidates:
            raise ValueError("Android SDK build-tools are not installed")
        tools = max(candidates, key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.parent.parent.name))).parent.parent
    signature = subprocess.run([
        "java", "-jar", str(tools / "lib" / "apksigner.jar"), "verify", "--print-certs", str(apk),
    ], capture_output=True, text=True)
    if signature.returncode:
        raise ValueError("Android apksigner rejected the APK signature")
    certificates = re.findall(r"certificate SHA-256 digest:\s*([0-9a-fA-F]+)", signature.stdout)
    if len(certificates) != 1:
        raise ValueError("Expected one APK signing certificate")
    certificate = certificates[0].lower()
    if expected_certificate and certificate != expected_certificate.lower():
        raise ValueError("APK signing certificate differs from the existing app")
    zipalign = tools / ("zipalign.exe" if os.name == "nt" else "zipalign")
    alignment = subprocess.run([str(zipalign), "-c", "-P", "16", "4", str(apk)], capture_output=True, text=True)
    if alignment.returncode:
        raise ValueError("Android zipalign rejected the APK alignment")
    return {"signatureVerified": True, "zipAlignmentVerified": True, "certificateSha256": certificate}


def manifest_package(data):
    strings = []
    offset = 8
    while offset + 8 <= len(data):
        kind, header_size, size = struct.unpack_from("<HHI", data, offset)
        if size < 8 or offset + size > len(data):
            raise ValueError("Invalid Android binary XML chunk")
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from("<IIIII", data, offset + 8)
            for index in range(count):
                position = offset + start + struct.unpack_from("<I", data, offset + header_size + index * 4)[0]
                if flags & 0x100:
                    # UTF-8 strings prefix both the UTF-16 character and byte lengths.
                    for length_index in range(2):
                        length = data[position]
                        position += 1
                        if length & 0x80:
                            length = ((length & 0x7F) << 8) | data[position]
                            position += 1
                    value = data[position:position + length].decode("utf-8")
                else:
                    length = struct.unpack_from("<H", data, position)[0]
                    position += 2
                    if length & 0x8000:
                        length = ((length & 0x7FFF) << 16) | struct.unpack_from("<H", data, position)[0]
                        position += 2
                    value = data[position:position + length * 2].decode("utf-16-le")
                strings.append(value)
        elif kind == 0x102:
            name = struct.unpack_from("<I", data, offset + 20)[0]
            if strings[name] == "manifest":
                attribute_start, attribute_size, count = struct.unpack_from("<HHH", data, offset + 24)
                for index in range(count):
                    position = offset + 16 + attribute_start + index * attribute_size
                    _, name, raw = struct.unpack_from("<III", data, position)
                    if strings[name] == "package":
                        value = raw if raw != 0xFFFFFFFF else struct.unpack_from("<I", data, position + 16)[0]
                        return strings[value]
        offset += size
    raise ValueError("APK manifest has no package identifier")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--package", required=True)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--require-android-tools", action="store_true")
    parser.add_argument("--certificate-sha256")
    args = parser.parse_args()
    with zipfile.ZipFile(args.apk) as archive:
        if archive.testzip() is not None:
            raise ValueError("APK ZIP integrity check failed")
        package = manifest_package(archive.read("AndroidManifest.xml"))
        if package != args.package:
            raise ValueError(f"Wrong APK package: {package}")
        archive.getinfo("classes.dex")
        bundle = archive.read("assets/index.android.bundle")
        if not any(args.api_url.encode(codec) in bundle for codec in ("utf-8", "utf-16-le")):
            raise ValueError("Expected API URL is missing from the JavaScript bundle")
    with args.apk.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    result = {"package": package, "apiUrl": args.api_url, "sizeBytes": args.apk.stat().st_size,
              "sha256": digest, "verified": True}
    if args.require_android_tools:
        result["androidVerification"] = verify_android_tools(args.apk, args.certificate_sha256)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
