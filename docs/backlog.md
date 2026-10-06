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
