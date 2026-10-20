# Changes
## 2026-10-06
- Initial QR Code Builder: content types, styling, PNG/SVG export, Docker packaging, tests.

## 2026-10-06 (later)
- Replaced qr-code-styling with an own SVG renderer; added custom eye and dot SVG upload with sanitizing, UTF-8 payloads and a decode-based scan check.

## 2026-10-19
- Added XOR logo placement: full-size logo with the QR code (middle 2/3) inverting the logo under dark modules.

## 2026-10-20
- Split the logo option into Logo placement (center / full size) and Mixture mode (overlay / XOR); added overlay mode.
- Added the Translucent mixture mode (code background 30% transparent, i.e. 70% opaque, over the full-size logo).
