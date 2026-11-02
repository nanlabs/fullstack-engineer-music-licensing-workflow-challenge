//! Real-time stream (`GET /api/v1/events`) against a real PostgreSQL
//! database. Same harness as `licenses_api.rs`; covers the checklist in
//! `docs/licensing.md`: cookie authentication, the opening frames, a live
//! `license.changed` after a transition, the replay from `Last-Event-ID`
//! (seed included, in position order), the error replies (401, 403, 400),
//! tenant isolation and the replay after a track is deleted. Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p licensing -- --include-ignored
//! ```

use std::fmt::Debug;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use actix_web::body::MessageBody;
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::header::HeaderMap;
use actix_web::http::StatusCode;
use actix_web::test::{self, TestRequest};
use actix_web::{web, App};
use futures_util::future::poll_fn;
use iam::testing::{call, delete_as, login_with_otp, post_as, Outbox, ACME_LICENSING_EMAIL, ACME_TENANT};
use iam::IamConfig;
use serde_json::{json, Value};
use sqlx::PgPool;
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;

const EVENTS: &str = "/api/v1/events";
/// Scene and song from the seed; the track the walkthrough moves.
const FINAL_BOW: &str = "55555555-5555-4555-8555-555555555553";
const PAPER_MOONS: &str = "66666666-6666-4666-8666-666666666664";
const T_OPENING: &str = "77777777-7777-4777-8777-777777777771";
const T_FINAL_BOW: &str = "77777777-7777-4777-8777-777777777773";
/// Events seeded by `0012_seed_licenses.sql`.
const SEEDED_EVENTS: i64 = 9;
const READER_ID: &str = "22222222-2222-4222-8222-222222222228";
const OTHER_TENANT: &str = "99999999-9999-4999-8999-999999999999";
const OTHER_MOVIE: &str = "99999999-9999-4999-8999-999999999901";
const OTHER_SCENE: &str = "99999999-9999-4999-8999-999999999902";
const OTHER_SONG: &str = "99999999-9999-4999-8999-999999999903";
const OTHER_TRACK: &str = "99999999-9999-4999-8999-999999999904";
const OTHER_USER: &str = "99999999-9999-4999-8999-999999999905";

fn transition(id: &str, event: &str) -> String {
    format!("/api/v1/tracks/{id}/license/{event}")
}

/// What a browser sends: the access cookie, no `Authorization` header.
fn stream_request(token: &str, last_event_id: Option<&str>) -> TestRequest {
    let mut req = TestRequest::get()
        .uri(EVENTS)
        .insert_header(("cookie", format!("access_token={token}")));
    if let Some(id) = last_event_id {
        req = req.insert_header(("last-event-id", id));
    }
    req
}

/// An open stream: status, headers and the body, read frame by frame.
struct Stream<B> {
    status: StatusCode,
    headers: HeaderMap,
    body: Pin<Box<B>>,
}

impl<B: MessageBody> Stream<B> {
    /// The next chunk as text, or `None` when nothing arrives within `wait`
    /// (or the stream ended). Every chunk is one SSE message.
    async fn next(&mut self, wait: Duration) -> Option<String> {
        let chunk = timeout(wait, poll_fn(|cx| self.body.as_mut().poll_next(cx)))
            .await
            .ok()??;
        let bytes = chunk.unwrap_or_else(|_| panic!("stream body error"));
        Some(String::from_utf8(bytes.to_vec()).unwrap())
    }

    /// The next `license.changed` message: its id and payload. Fails if
    /// anything else (or nothing) arrives.
    async fn next_change(&mut self) -> (i64, Value) {
        let frame = self.next(Duration::from_secs(2)).await.expect("a message within 2s");
        let mut lines = frame.lines();
        assert_eq!(lines.next(), Some("event: license.changed"), "{frame}");
        let id = lines.next().unwrap().strip_prefix("id: ").unwrap().parse().unwrap();
        let data = lines.next().unwrap().strip_prefix("data: ").unwrap();
        (id, serde_json::from_str(data).unwrap())
    }

    /// Skips the `retry` line and the `connected` comment every stream opens with.
    async fn opened(&mut self) {
        assert_eq!(
            self.next(Duration::from_secs(2)).await.as_deref(),
            Some("retry: 3000\n\n")
        );
        assert_eq!(
            self.next(Duration::from_secs(2)).await.as_deref(),
            Some(": connected\n\n")
        );
    }
}

async fn open<S, R, B, E>(app: &S, req: R) -> Stream<B>
where
    S: Service<R, Response = ServiceResponse<B>, Error = E>,
    B: MessageBody,
    E: Debug,
{
    let resp = test::try_call_service(app, req).await.expect("stream response");
    let status = resp.status();
    let headers = resp.headers().clone();
    Stream {
        status,
        headers,
        body: Box::pin(resp.into_body()),
    }
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn license_changes_stream_replay_and_isolation(pool: PgPool) {
    let outbox = Arc::new(Outbox::default());
    let iam = iam::Container::new(iam::Deps {
        pool: pool.clone(),
        config: IamConfig::development("test-secret-that-is-long-enough-for-hs256!!"),
        otp_notifier: outbox.clone(),
        invitation_notifier: outbox.clone(),
    });
    let licensing = licensing::Container::new(licensing::Deps {
        pool: pool.clone(),
        config: licensing::LicensingConfig::default(),
        redis: None,
        shutdown: CancellationToken::new(),
    });
    let app = test::init_service(
        App::new().service(
            web::scope("/api/v1")
                .configure(|cfg| iam.configure(cfg))
                .configure(|cfg| licensing.configure(cfg)),
        ),
    )
    .await;

    // Anonymous: the usual JSON 401 (a non-200 also stops EventSource from retrying).
    let r = call(&app, TestRequest::get().uri(EVENTS).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    // The stream carries licensing status, so it needs movies:read.
    sqlx::query(
        "INSERT INTO users (id, tenant_id, email, name, status, scopes, email_verified) \
         VALUES ($1::uuid, $2::uuid, 'reader@acme.test', 'Reader', 'active', '{users:read}', true)",
    )
    .bind(READER_ID)
    .bind(ACME_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    let reader = login_with_otp(&app, &outbox, "reader@acme.test", ACME_TENANT)
        .await
        .access_token;
    let r = call(&app, stream_request(&reader, None).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["required_scope"], "movies:read");

    // The licensing manager opens the stream with the cookie alone.
    let manager = login_with_otp(&app, &outbox, ACME_LICENSING_EMAIL, ACME_TENANT)
        .await
        .access_token;
    let mut live = open(&app, stream_request(&manager, None).to_request()).await;
    assert_eq!(live.status, StatusCode::OK);
    let content_type = live.headers.get("content-type").unwrap().to_str().unwrap();
    assert!(content_type.starts_with("text/event-stream"), "{content_type}");
    assert_eq!(live.headers.get("cache-control").unwrap(), "no-cache");
    assert_eq!(live.headers.get("x-accel-buffering").unwrap(), "no");
    live.opened().await;
    assert_eq!(
        live.next(Duration::from_millis(200)).await,
        None,
        "quiet until something moves"
    );

    // A transition shows up as a license.changed with the track embedded.
    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "request"),
            json!({ "note": "not for the stream" }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let (first_id, change) = live.next_change().await;
    assert_eq!(first_id, SEEDED_EVENTS + 1, "positions continue after the seed");
    assert_eq!(change["position"], first_id);
    assert_eq!(change["tenant_id"], ACME_TENANT);
    assert_eq!(change["event"], "request");
    assert_eq!(
        (change["from_state"].as_str(), change["to_state"].as_str()),
        (Some("pending"), Some("requested"))
    );
    assert_eq!(change["source"], "acme");
    assert_eq!(change["seq"], 1);
    assert_eq!(change["track"]["id"], T_FINAL_BOW);
    assert_eq!(change["track"]["license"]["state"], "requested");
    assert_eq!(
        change["track"]["license"]["allowed_events"],
        json!(["start_negotiation", "reject"])
    );
    assert!(
        change.get("note").is_none() && change.get("actor").is_none(),
        "{change}"
    );
    assert_eq!(live.next(Duration::from_millis(200)).await, None);

    // Reconnecting with Last-Event-ID replays what came after it, then goes live.
    let mut resumed = open(
        &app,
        stream_request(&manager, Some(&(first_id - 1).to_string())).to_request(),
    )
    .await;
    assert_eq!(resumed.status, StatusCode::OK);
    resumed.opened().await;
    let (replayed_id, replayed) = resumed.next_change().await;
    assert_eq!(replayed_id, first_id);
    assert_eq!(replayed["track"]["id"], T_FINAL_BOW);
    assert_eq!(resumed.next(Duration::from_millis(200)).await, None);
    // From the beginning: the seed and the new event, in position order.
    let mut from_start = open(&app, stream_request(&manager, Some("0")).to_request()).await;
    from_start.opened().await;
    let mut ids = Vec::new();
    for _ in 0..=SEEDED_EVENTS {
        let (id, change) = from_start.next_change().await;
        if id == 1 {
            assert_eq!(change["track"]["id"], T_OPENING);
            assert_eq!(change["event"], "request");
        }
        ids.push(id);
    }
    assert_eq!(ids, (1..=first_id).collect::<Vec<_>>());
    assert_eq!(from_start.next(Duration::from_millis(200)).await, None);
    drop(from_start);
    // An id that is not a position is a client error, as JSON.
    let r = call(&app, stream_request(&manager, Some("abc")).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["field"], "last_event_id");

    // Another tenant hears nothing of ACME's negotiations.
    sqlx::query("INSERT INTO tenants (id, slug, name) VALUES ($1::uuid, 'other', 'Other Studios')")
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO movies (id, tenant_id, title) VALUES ($1::uuid, $2::uuid, 'Not Yours')")
        .bind(OTHER_MOVIE)
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO scenes (id, tenant_id, movie_id, position, title) \
         VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'Their scene')",
    )
    .bind(OTHER_SCENE)
    .bind(OTHER_TENANT)
    .bind(OTHER_MOVIE)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO songs (id, tenant_id, title, artist, rights_holder) \
         VALUES ($1::uuid, $2::uuid, 'Their Song', 'Them', 'Their Label')",
    )
    .bind(OTHER_SONG)
    .bind(OTHER_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO tracks (id, tenant_id, scene_id, song_id, start_ms, end_ms, usage) \
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 0, 1000, 'background')",
    )
    .bind(OTHER_TRACK)
    .bind(OTHER_TENANT)
    .bind(OTHER_SCENE)
    .bind(OTHER_SONG)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO licenses (track_id, tenant_id) VALUES ($1::uuid, $2::uuid)")
        .bind(OTHER_TRACK)
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users (id, tenant_id, email, name, status, scopes, email_verified) \
         VALUES ($1::uuid, $2::uuid, 'them@other.test', 'Them', 'active', '{movies:read}', true)",
    )
    .bind(OTHER_USER)
    .bind(OTHER_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    let them = login_with_otp(&app, &outbox, "them@other.test", OTHER_TENANT)
        .await
        .access_token;
    let mut theirs = open(&app, stream_request(&them, Some("0")).to_request()).await;
    assert_eq!(theirs.status, StatusCode::OK);
    theirs.opened().await;
    assert_eq!(
        theirs.next(Duration::from_millis(200)).await,
        None,
        "no replay of ACME's events"
    );
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "start_negotiation"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let (second_id, change) = live.next_change().await;
    assert_eq!(second_id, first_id + 1);
    assert_eq!(
        (change["event"].as_str(), change["source"].as_str()),
        (Some("start_negotiation"), Some("rights_holder"))
    );
    assert_eq!(
        resumed.next_change().await.0,
        second_id,
        "every open stream of the tenant hears it"
    );
    assert_eq!(
        theirs.next(Duration::from_millis(300)).await,
        None,
        "the other tenant does not"
    );

    // A deleted track takes its events along: nothing to replay for it.
    let r = call(
        &app,
        post_as(
            &format!("/api/v1/scenes/{FINAL_BOW}/tracks"),
            json!({ "song_id": PAPER_MOONS, "start_ms": 0, "end_ms": 1000, "usage": "featured" }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    let created = r.body["id"].as_str().unwrap().to_owned();
    let r = call(
        &app,
        post_as(&transition(&created, "request"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let (third_id, change) = live.next_change().await;
    assert_eq!(third_id, second_id + 1);
    assert_eq!(change["track"]["id"], created);
    // A requested cue is frozen; rejecting it frees the track.
    let r = call(
        &app,
        delete_as(&format!("/api/v1/tracks/{created}"), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "TRACK_LOCKED_BY_LICENSE");
    let r = call(
        &app,
        post_as(&transition(&created, "reject"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let (fourth_id, change) = live.next_change().await;
    assert_eq!(fourth_id, third_id + 1);
    assert_eq!(change["to_state"], "rejected");
    let r = call(
        &app,
        delete_as(&format!("/api/v1/tracks/{created}"), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let remaining: i64 = sqlx::query_scalar("SELECT count(*) FROM license_events WHERE track_id = $1::uuid")
        .bind(&created)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, 0);
    let mut after_delete = open(
        &app,
        stream_request(&manager, Some(&(third_id - 1).to_string())).to_request(),
    )
    .await;
    after_delete.opened().await;
    assert_eq!(
        after_delete.next(Duration::from_millis(200)).await,
        None,
        "the deleted track's event is gone"
    );
}
