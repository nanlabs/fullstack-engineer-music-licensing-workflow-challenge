# ── Build stage ──────────────────────────────────────────────────────────────
FROM rust:1.88-slim AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Cache dependencies by building a dummy main
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs \
    && cargo build --release && rm -rf src

COPY src src
COPY migrations migrations
# Touch main.rs/lib.rs so cargo rebuilds the real binary/lib, not the cached dummy
RUN touch src/main.rs src/lib.rs && cargo build --release

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/backend /usr/local/bin/backend

ENV RUST_LOG=info
EXPOSE 8080

CMD ["backend"]
