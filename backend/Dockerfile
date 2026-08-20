# syntax=docker/dockerfile:1

FROM rust:1.96-bookworm AS builder
WORKDIR /build
ENV SQLX_OFFLINE=true
COPY Cargo.toml Cargo.lock ./
COPY .sqlx ./.sqlx
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 app
WORKDIR /app
COPY --from=builder /build/target/release/music-licensing-api /usr/local/bin/music-licensing-api
COPY --from=builder /build/migrations /app/migrations
USER app
EXPOSE 8080
ENTRYPOINT ["music-licensing-api"]
CMD ["serve"]
