"""Verify an APK's package, embedded API URL, and ZIP integrity without an Android SDK."""
import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path


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
    print(json.dumps({"package": package, "apiUrl": args.api_url, "sizeBytes": args.apk.stat().st_size,
                      "sha256": hashlib.file_digest(args.apk.open("rb"), "sha256").hexdigest(),
                      "verified": True}))


if __name__ == "__main__":
    main()
