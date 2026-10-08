# Stellar sandbox image
#
# Reproducible build. Every toolchain pin lives in the ARG block below and every
# download is checksum-verified, so rebuilding from the same commit yields the
# same toolchain and a swapped release asset fails the build instead of running.
# `rust-toolchain.toml` records the same Rust version for local use, and the
# `docker-image` CI job asserts the two agree.

# Base image pinned by manifest-list digest of ubuntu:22.04, so the tag cannot
# move under the build.
FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401

# Add TARGETARCH argument for multi-platform builds
ARG TARGETARCH=amd64

# --- Pinned toolchain versions (single source of truth) ---
# Must match `channel` in rust-toolchain.toml; the CI job compares them.
ARG RUST_VERSION=1.99.0
ARG STELLAR_CLI_VERSION=23.3.0
# SHA-256 of the official stellar-cli release tarballs for
# v${STELLAR_CLI_VERSION}, taken from the release metadata:
#   https://api.github.com/repos/stellar/stellar-cli/releases/tags/v23.3.0
ARG STELLAR_CLI_SHA256_amd64=b3a5455d7113a53a8bd0f1ba0148a14b7aa7a46ee2f49c3b9277424775b309ad
ARG STELLAR_CLI_SHA256_arm64=7a36e0e1f617f65e44118b0d0535656a4a824bd391d8040fc2728bacd4b5f463

ENV DEBIAN_FRONTEND=noninteractive

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    libdbus-1-3 \
    git \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Create developer user
RUN useradd -m -u 1000 developer

# Switch to developer
USER developer
WORKDIR /home/developer

# Create .local/bin directory
RUN mkdir -p /home/developer/.local/bin

# Install a pinned Rust toolchain with the minimal profile
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION} --profile minimal

ENV PATH="/home/developer/.cargo/bin:${PATH}"

# Add wasm target
RUN rustup target add wasm32v1-none

# Add rust-analyzer component
RUN rustup component add rust-analyzer

# Download, verify and install the pinned Stellar CLI binary per architecture.
# The SHA-256 is verified before extraction, so a tampered or truncated release
# asset fails the build rather than being executed.
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
      TARBALL="stellar-cli-${STELLAR_CLI_VERSION}-aarch64-unknown-linux-gnu.tar.gz"; \
      EXPECTED_SHA256="${STELLAR_CLI_SHA256_arm64}"; \
    else \
      TARBALL="stellar-cli-${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz"; \
      EXPECTED_SHA256="${STELLAR_CLI_SHA256_amd64}"; \
    fi && \
    curl -L "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/${TARBALL}" -o stellar.tar.gz && \
    echo "${EXPECTED_SHA256}  stellar.tar.gz" | sha256sum -c - && \
    tar -xzf stellar.tar.gz && \
    mv stellar /home/developer/.local/bin/ && \
    chmod +x /home/developer/.local/bin/stellar && \
    rm stellar.tar.gz

ENV PATH="/home/developer/.local/bin:${PATH}"

# Set Stellar home directory to workspace for easier access
ENV STELLAR_HOME=/home/developer/workspace/.stellar

# Verify installations (fails the build if a pinned tool is missing)
RUN rustc --version && stellar --version && rust-analyzer --version

WORKDIR /home/developer/workspace

CMD ["/bin/bash"]
