use serde::{Deserialize, Serialize};

pub const DEFAULT_PAGE_SIZE: u32 = 20;
pub const MAX_PAGE_SIZE: u32 = 100;

/// Pagination query parameters (1-based page number).
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct PageQuery {
    #[serde(default = "PageQuery::default_page")]
    pub page: u32,
    #[serde(default = "PageQuery::default_size")]
    pub page_size: u32,
}

impl PageQuery {
    fn default_page() -> u32 {
        1
    }

    fn default_size() -> u32 {
        DEFAULT_PAGE_SIZE
    }

    /// Normalizes out-of-range values instead of rejecting them.
    pub fn normalized(self) -> Self {
        Self {
            page: self.page.max(1),
            page_size: self.page_size.clamp(1, MAX_PAGE_SIZE),
        }
    }

    pub fn limit(&self) -> i64 {
        i64::from(self.page_size)
    }

    pub fn offset(&self) -> i64 {
        i64::from(self.page.saturating_sub(1)) * self.limit()
    }
}

impl Default for PageQuery {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PageInfo {
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
    pub pages: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub pagination: PageInfo,
    pub empty: bool,
}

impl<T> Paginated<T> {
    pub fn new(items: Vec<T>, query: PageQuery, total: u64) -> Self {
        let size = u64::from(query.page_size.max(1));
        let pages = u32::try_from(total.div_ceil(size)).unwrap_or(u32::MAX);
        Self {
            empty: items.is_empty(),
            items,
            pagination: PageInfo {
                page: query.page,
                page_size: query.page_size,
                total,
                pages,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_computes_offsets() {
        let q = PageQuery {
            page: 0,
            page_size: 500,
        }
        .normalized();
        assert_eq!((q.page, q.page_size), (1, MAX_PAGE_SIZE));
        let q = PageQuery { page: 3, page_size: 10 };
        assert_eq!((q.limit(), q.offset()), (10, 20));
    }

    #[test]
    fn page_count_is_ceiling_division() {
        let p = Paginated::new(vec![1, 2], PageQuery { page: 1, page_size: 2 }, 5);
        assert_eq!(p.pagination.pages, 3);
        assert!(!p.empty);
        let empty: Paginated<i32> = Paginated::new(vec![], PageQuery::default(), 0);
        assert!(empty.empty);
        assert_eq!(empty.pagination.pages, 0);
    }
}
