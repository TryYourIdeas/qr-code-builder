# Backlog

## Tracked / dynamic QR codes
- **Description:** short redirect links so a code's target can change and scans can be counted.
- **Value:** reuse printed codes; usage analytics.
- **Consequence of not doing it:** codes are static; changing the target means reprinting.

## Saved library of codes
- **Description:** logged-in users (SSO via `iam`) save, name and re-download codes (Postgres + Drizzle).
- **Value:** return to previous codes without re-entering data.
- **Consequence of not doing it:** users must recreate codes each time.

## Apply the Stitch design
- **Description:** Stitch screen generation timed out during the initial build, so the UI follows the plan's Tailwind skeleton. Re-run screen generation in project `232569223006492583` and align the page styling to it.
- **Value:** visual consistency with the workspace's design source of truth.
- **Consequence of not doing it:** the UI works and is accessible but may differ from the intended design.

## Fix `nuxt typecheck`
- **Description:** `vue-tsc` crashes with the installed TypeScript (`ERR_PACKAGE_PATH_NOT_EXPORTED ./lib/tsc`). Pin compatible `typescript`/`vue-tsc` versions.
- **Value:** static type checking of `.vue` files in CI and locally.
- **Consequence of not doing it:** type errors in components surface only in the editor.

## Verify the Docker image
- **Description:** the Dockerfile/nginx config could not be built on the authoring machine (host Docker overlayfs fault). Build and smoke-test with `docker compose up --build` on a healthy host.
- **Value:** confirms packaging works as written.
- **Consequence of not doing it:** a packaging defect would only appear at deploy time.

## Logo handling hardening
- **Description:** clear the file input after a rejected or removed logo (re-picking the same file currently does nothing); preload the logo with `new Image()` and show an error when it cannot be decoded (a renamed non-image currently yields a blank preview with no message).
- **Value:** no silent failures when choosing a logo.
- **Consequence of not doing it:** users with a bad or re-picked logo see no change and no explanation.

## Scannability warnings and input strictness
- **Description:** warn when size / module count drops below ~3 px per module (e.g. 200 px with dense content); reject `?`/`&` in the mailto address; only accept `+` at the start of phone numbers; validate Wi-Fi (WPA password 8–63 chars, SSID ≤ 32 bytes, quote all-hex values, show/hide password); CRLF-fold vCard lines and stop escaping the vCard URL value.
- **Value:** fewer codes that scan but do the wrong thing or cannot be used.
- **Consequence of not doing it:** some edge-case inputs produce codes that fail to scan or behave unexpectedly.

## Accessibility and delivery polish
- **Description:** explain why Download buttons are disabled ("Complete the required fields"); `tabindex="0"` on the tab panel; nginx `Cache-Control: no-cache` for `index.html` and 404 for missing `/_nuxt/` assets; a UTF-8/emoji decode test.
- **Value:** clearer UX for keyboard/screen-reader users and safer redeploys.
- **Consequence of not doing it:** minor UX friction; a cached `index.html` can reference assets removed by a redeploy.

## Restore dropped dot styles and gradients
- **Description:** `classy`, `classy-rounded`, `extra-rounded` dot styles and color gradients were available with qr-code-styling; redraw them as bundled tiles/gradients.
- **Value:** more built-in looks without needing an SVG file.
- **Consequence of not doing it:** fewer built-in styles, although a custom SVG can reproduce any look.

## Separate outer-frame and inner-dot eye SVGs
- **Description:** allow two uploads (frame and center) or a different eye per corner.
- **Value:** finer control of the eye design.
- **Consequence of not doing it:** one eye design is used for all three corners.
