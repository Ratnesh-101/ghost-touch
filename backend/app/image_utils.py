"""Utilities for safe image inspection, header parsing, and dimension capping (F2).

Protects against hostile or malformed image uploads (e.g., decompression bombs,
truncated files, declared MIME spoofing) before invoking paid vision models or OpenCV.
"""

from __future__ import annotations

import struct

from fastapi import HTTPException

MAX_IMAGE_PIXELS = 12_000_000  # 12 megapixels (SEC-02)


def sniff_image_format(data: bytes) -> str | None:
    """Sniff the true image format from file magic bytes.

    Supports JPEG, PNG, and WebP.
    """
    if len(data) >= 8 and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 3 and data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _parse_exif_orientation(data: bytes, offset: int, length: int) -> int | None:
    """Parse EXIF orientation tag (0x0112) from APP1 segment (SEC-04)."""
    if length < 14 or data[offset + 2 : offset + 8] != b"Exif\x00\x00":
        return None
    tiff_start = offset + 8
    endian_flag = data[tiff_start : tiff_start + 2]
    if endian_flag == b"II":
        endian = "<"
    elif endian_flag == b"MM":
        endian = ">"
    else:
        return None
    try:
        first_ifd_offset = struct.unpack(endian + "I", data[tiff_start + 4 : tiff_start + 8])[0]
        ifd_pos = tiff_start + first_ifd_offset
        if ifd_pos + 2 > offset + length:
            return None
        num_entries = struct.unpack(endian + "H", data[ifd_pos : ifd_pos + 2])[0]
        entry_pos = ifd_pos + 2
        for _ in range(num_entries):
            if entry_pos + 12 > offset + length:
                break
            tag = struct.unpack(endian + "H", data[entry_pos : entry_pos + 2])[0]
            if tag == 0x0112:  # Orientation tag
                return struct.unpack(endian + "H", data[entry_pos + 8 : entry_pos + 10])[0]
            entry_pos += 12
    except Exception:
        return None
    return None


def sniff_image_dimensions(data: bytes) -> tuple[int, int] | None:
    """Extract (width, height) in pixels from the image header without full decode.

    Returns (width, height) if valid, or None if the header is corrupt or truncated.
    """
    if len(data) < 8:
        return None

    # PNG: IHDR chunk width and height at bytes 16-24
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        if len(data) < 24:
            return None
        try:
            width, height = struct.unpack(">II", data[16:24])
            return (width, height)
        except struct.error:
            return None

    # WebP: RIFF ... WEBP with VP8, VP8L, or VP8X chunks
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        chunk = data[12:16]
        try:
            if chunk == b"VP8 " and len(data) >= 30:
                if data[23:26] != b"\x9d\x01\x2a":
                    return None
                width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
                height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
                return (width, height)
            elif chunk == b"VP8L" and len(data) >= 25:
                if data[20] != 0x2F:
                    return None
                b1, b2, b3, b4 = data[21:25]
                width = 1 + (((b2 & 0x3F) << 8) | b1)
                height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6))
                return (width, height)
            elif chunk == b"VP8X" and len(data) >= 30:
                width = 1 + struct.unpack("<I", data[24:27] + b"\x00")[0]
                height = 1 + struct.unpack("<I", data[27:30] + b"\x00")[0]
                return (width, height)
        except Exception:
            return None
        return None

    # JPEG: Walk markers to Start Of Frame (SOF)
    if data.startswith(b"\xff\xd8\xff"):
        offset = 2
        orientation: int | None = None
        try:
            while offset < len(data) - 1:
                if data[offset] != 0xFF:
                    return None
                marker = data[offset + 1]
                offset += 2
                while marker == 0xFF and offset < len(data):
                    marker = data[offset]
                    offset += 1
                if marker == 0xE1:
                    if offset + 2 > len(data):
                        return None
                    seg_len = struct.unpack(">H", data[offset : offset + 2])[0]
                    orientation = _parse_exif_orientation(data, offset, seg_len)
                    offset += seg_len
                    continue
                # SOF0 through SOF15 except DHT/JPG/DAC
                if marker in (
                    0xC0,
                    0xC1,
                    0xC2,
                    0xC3,
                    0xC5,
                    0xC6,
                    0xC7,
                    0xC9,
                    0xCA,
                    0xCB,
                    0xCD,
                    0xCE,
                    0xCF,
                ):
                    if offset + 7 > len(data):
                        return None
                    height, width = struct.unpack(">HH", data[offset + 3 : offset + 7])
                    if orientation in (5, 6, 7, 8):
                        width, height = height, width
                    return (width, height)
                elif marker in (0xD9, 0xDA):  # EOI or SOS (Scan starts, SOF missing)
                    return None
                else:
                    if offset + 2 > len(data):
                        return None
                    length = struct.unpack(">H", data[offset : offset + 2])[0]
                    offset += length
        except Exception:
            return None
        return None

    return None


def validate_image_bytes(data: bytes, declared_mime: str | None = None) -> tuple[str, int, int]:
    """Validate image magic bytes, header integrity, and pixel resolution cap.

    Returns (detected_mime, width, height).
    Raises HTTPException(415) on unrecognized or mismatched format signature.
    Raises HTTPException(422) on truncated/corrupt image or if resolution > 40 MP.
    """
    detected_mime = sniff_image_format(data)
    if detected_mime is None:
        raise HTTPException(
            status_code=415,
            detail=(
                "Invalid image file signature. Please upload a valid JPEG, PNG, or WebP image."
            ),
        )

    if declared_mime:
        norm_declared = declared_mime.lower().split(";")[0].strip()
        if norm_declared == "image/jpg":
            norm_declared = "image/jpeg"
        if norm_declared != detected_mime:
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Declared content type '{declared_mime}' does not match "
                    f"detected image format '{detected_mime}'."
                ),
            )

    dims = sniff_image_dimensions(data)
    if dims is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Image file header is corrupted or truncated. "
                "Please upload a complete, valid diagram image."
            ),
        )

    width, height = dims
    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=422,
            detail="Invalid image dimensions in file header.",
        )

    total_pixels = width * height
    if total_pixels > MAX_IMAGE_PIXELS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Image resolution ({width}x{height} = {total_pixels // 1_000_000} MP) "
                f"exceeds maximum allowed {MAX_IMAGE_PIXELS // 1_000_000} megapixels."
            ),
        )

    return detected_mime, width, height
