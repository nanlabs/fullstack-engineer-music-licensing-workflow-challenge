use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ============================================================================
// Pagination
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Page {
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
    pub pages: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub pagination: Page,
    pub empty: bool,
}

impl<T> Paginated<T> {
    pub fn new(items: Vec<T>, page: i64, page_size: i64, total: i64) -> Self {
        let pages = if page_size > 0 {
            (total + page_size - 1) / page_size
        } else {
            0
        };

        let empty = items.is_empty();

        Self {
            items,
            pagination: Page {
                page,
                page_size,
                total,
                pages,
            },
            empty,
        }
    }

    pub fn has_next(&self) -> bool {
        self.pagination.page < self.pagination.pages
    }

    pub fn has_previous(&self) -> bool {
        self.pagination.page > 1
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PaginationOptions {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page() -> i64 {
    1
}

fn default_page_size() -> i64 {
    20
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: default_page(),
            page_size: default_page_size(),
        }
    }
}

impl PaginationOptions {
    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.page_size
    }

    pub fn limit(&self) -> i64 {
        self.page_size
    }
}
