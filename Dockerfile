FROM ubuntu:22.04

# Add TARGETARCH argument for multi-platform builds
ARG TARGETARCH=amd64

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

# Install Rust with minimal profile
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal

ENV PATH="/home/developer/.cargo/bin:${PATH}"

# Add wasm target
RUN rustup target add wasm32v1-none

# Add rust-analyzer component
RUN rustup component add rust-analyzer

# Download and install Stellar CLI binary based on architecture
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
    curl -L https://github.com/stellar/stellar-cli/releases/download/v23.3.0/stellar-cli-23.3.0-aarch64-unknown-linux-gnu.tar.gz -o stellar.tar.gz; \
    else \
    curl -L https://github.com/stellar/stellar-cli/releases/download/v23.3.0/stellar-cli-23.3.0-x86_64-unknown-linux-gnu.tar.gz -o stellar.tar.gz; \
    fi && \
    tar -xzf stellar.tar.gz && \
    mv stellar /home/developer/.local/bin/ && \
    chmod +x /home/developer/.local/bin/stellar && \
    rm stellar.tar.gz

ENV PATH="/home/developer/.local/bin:${PATH}"

# Keep the Stellar home (identities) in the container user's home, OUTSIDE the
# workspace that project listing/creation/deletion operate on, so deleting a
# project cannot destroy the wallet identity.
ENV STELLAR_HOME=/home/developer/.stellar

# Verify installations
RUN rustc --version && stellar --version && rust-analyzer --version

WORKDIR /home/developer/workspace

CMD ["/bin/bash"]