/**
 * Single source of truth for the Stellar sandbox container image.
 *
 * `SANDBOX_IMAGE_VERSION` is the immutable, reproducible release the app
 * expects. It must match the `SANDBOX_IMAGE_VERSION` build arg in the
 * `Dockerfile` (where the toolchain is pinned) so a build can be traced back to
 * the app that expects it.
 *
 * `SANDBOX_IMAGE` is the immutable tag the runtime launches containers from.
 * `SANDBOX_IMAGE_FLOATING` is the convenience alias (`stellar-sandbox:v1`) kept
 * for `docker build` muscle memory; the app never runs against it.
 */

export const SANDBOX_IMAGE_VERSION = '1.0.0';

export const SANDBOX_IMAGE = `stellar-sandbox:${SANDBOX_IMAGE_VERSION}`;

export const SANDBOX_IMAGE_FLOATING = 'stellar-sandbox:v1';
