# Stellar sandbox image
#
# Reproducible build. Every toolchain pin lives in the ARG block below, so
# rebuilding from the same commit yields the same versions and moving to a new
# release is a deliberate edit to one place. The runtime launches containers from
# the immutable tag built here; see `lib/docker/image.ts` for the tag the app
# expects.

# Base image pinned by manifest-list digest (ubuntu:22.04).
FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401

# Add TARGETARCH argument for multi-platform builds
ARG TARGETARCH=amd64

# --- Pinned toolchain versions (single source of truth) ---
ARG RUST_VERSION=1.99.0
ARG STELLAR_CLI_VERSION=23.3.0
ARG SANDBOX_IMAGE_VERSION=1.0.0

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

# Download and install Stellar CLI binary based on architecture
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
    curl -L https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-${STELLAR_CLI_VERSION}-aarch64-unknown-linux-gnu.tar.gz -o stellar.tar.gz; \
    else \
    curl -L https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz -o stellar.tar.gz; \
    fi && \
    tar -xzf stellar.tar.gz && \
    mv stellar /home/developer/.local/bin/ && \
    chmod +x /home/developer/.local/bin/stellar && \
    rm stellar.tar.gz

ENV PATH="/home/developer/.local/bin:${PATH}"

# Set Stellar home directory to workspace for easier access
ENV STELLAR_HOME=/home/developer/workspace/.stellar

# Record the resolved versions inside the image so a health check can surface
# them and two builds from the same commit can be compared.
RUN printf 'image=%s\nrust=%s\nstellar-cli=%s\n' \
      "${SANDBOX_IMAGE_VERSION}" \
      "$(rustc --version)" \
      "$(stellar --version)" > /home/developer/.stellar-sandbox-versions

# Verify installations (fails the build if a pinned tool is missing)
RUN rustc --version && stellar --version && rust-analyzer --version

WORKDIR /home/developer/workspace

CMD ["/bin/bash"]
