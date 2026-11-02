use crate::auth::extract::Auth;
use actix_web::{web, HttpResponse};
use errx::AppError;

use crate::Container;

/// GET /tenants/me
pub async fn get_my_tenant(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    let tenant = container.tenant_service.get_mine(&auth).await?;
    Ok(HttpResponse::Ok().json(tenant))
}

/// GET /scopes — the permission catalog (requires `scopes:read`).
pub async fn list_scopes(auth: Auth) -> Result<HttpResponse, AppError> {
    crate::authz::require(&auth, auth.tenant_id, crate::scopes::SCOPES_READ)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "scopes": crate::scopes::CATALOG,
        "wildcard": kernel::scope::WILDCARD,
    })))
}
