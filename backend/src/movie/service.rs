use std::sync::Arc;

use chrono::Utc;

use crate::error::AppError;
use crate::iam::user::{UserRepository, UserRepositoryExt};
use crate::kernel::{MovieId, Paginated, PaginationOptions, UserId};

use super::error::MovieError;
use super::model::{
    AddMovieMemberRequest, CreateMovieRequest, Movie, MovieFilter, MovieMember,
    MovieMemberWithDetails, MovieRole, MovieWithDetails, UpdateMovieRequest,
};
use super::port::MovieRepository;

pub struct MovieService {
    movie_repo: Arc<dyn MovieRepository>,
    user_repo: Arc<dyn UserRepository>,
}

impl MovieService {
    pub fn new(movie_repo: Arc<dyn MovieRepository>, user_repo: Arc<dyn UserRepository>) -> Self {
        Self {
            movie_repo,
            user_repo,
        }
    }

    // ========================================================================
    // Authorization helpers
    // ========================================================================

    /// Assert the actor is a movie team member with a write role
    /// (Owner, Supervisor, or Editor — not Viewer).
    async fn assert_team_writer(&self, movie_id: &MovieId, actor: &UserId) -> Result<(), AppError> {
        let member = self.movie_repo.get_member(movie_id, actor).await?;
        match member {
            Some(m) if m.role != MovieRole::Viewer => Ok(()),
            _ => Err(MovieError::not_authorized()),
        }
    }

    /// Assert the actor is the movie Owner.
    async fn assert_owner(&self, movie_id: &MovieId, actor: &UserId) -> Result<(), AppError> {
        let member = self.movie_repo.get_member(movie_id, actor).await?;
        match member {
            Some(m) if m.role == MovieRole::Owner => Ok(()),
            _ => Err(MovieError::not_authorized()),
        }
    }

    /// Assert the actor is Owner or Supervisor (can manage members).
    async fn assert_can_manage_members(
        &self,
        movie_id: &MovieId,
        actor: &UserId,
    ) -> Result<(), AppError> {
        let member = self.movie_repo.get_member(movie_id, actor).await?;
        match member {
            Some(m) if matches!(m.role, MovieRole::Owner | MovieRole::Supervisor) => Ok(()),
            _ => Err(MovieError::not_authorized()),
        }
    }

    // ========================================================================
    // CRUD
    // ========================================================================

    pub async fn create_movie(
        &self,
        req: CreateMovieRequest,
        created_by: UserId,
    ) -> Result<Movie, AppError> {
        req.validate()?;

        self.user_repo
            .get_by_id(&created_by)
            .await?
            .ok_or_else(|| AppError::not_found("User not found"))?;

        let mut movie = Movie::new(req.title, created_by);
        movie.description = req.description;
        movie.release_year = req.release_year;
        movie.director = req.director;

        // Creator becomes Owner; persisted atomically with the movie so a
        // movie can never exist without an owner.
        let owner_member = MovieMember {
            movie_id: movie.id.clone(),
            user_id: movie.created_by.clone(),
            role: MovieRole::Owner,
            joined_at: movie.created_at,
        };
        self.movie_repo
            .save_with_owner(&movie, &owner_member)
            .await?;

        Ok(movie)
    }

    pub async fn get_movie(&self, id: &MovieId) -> Result<Movie, AppError> {
        self.movie_repo
            .get_by_id(id)
            .await?
            .ok_or_else(MovieError::not_found)
    }

    pub async fn find_movies(
        &self,
        opts: &PaginationOptions,
        filter: &MovieFilter,
    ) -> Result<Paginated<Movie>, AppError> {
        self.movie_repo.find(opts, filter).await
    }

    pub async fn update_movie(
        &self,
        id: &MovieId,
        req: UpdateMovieRequest,
        actor: &UserId,
    ) -> Result<Movie, AppError> {
        req.validate()?;

        let movie = self.get_movie(id).await?;
        self.assert_team_writer(&movie.id, actor).await?;

        let mut movie = movie;

        if let Some(title) = req.title {
            movie.title = title;
        }
        if let Some(description) = req.description {
            movie.description = Some(description);
        }
        if let Some(year) = req.release_year {
            movie.release_year = Some(year);
        }
        if let Some(director) = req.director {
            movie.director = Some(director);
        }
        movie.updated_at = Utc::now();

        self.movie_repo.update(&movie).await?;
        Ok(movie)
    }

    pub async fn delete_movie(&self, id: &MovieId, actor: &UserId) -> Result<(), AppError> {
        self.get_movie(id).await?;
        self.assert_owner(id, actor).await?;
        self.movie_repo.delete(id).await
    }

    pub async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError> {
        self.movie_repo.list_by_user(user_id).await
    }

    // ========================================================================
    // Membership
    // ========================================================================

    pub async fn add_member(
        &self,
        movie_id: &MovieId,
        req: AddMovieMemberRequest,
        actor: &UserId,
    ) -> Result<MovieMember, AppError> {
        self.movie_repo
            .get_by_id(movie_id)
            .await?
            .ok_or_else(MovieError::not_found)?;

        self.assert_can_manage_members(movie_id, actor).await?;

        self.user_repo
            .get_by_id(&req.user_id)
            .await?
            .ok_or_else(|| AppError::not_found("User not found"))?;

        if self
            .movie_repo
            .get_member(movie_id, &req.user_id)
            .await?
            .is_some()
        {
            return Err(MovieError::member_already_added());
        }

        let role = match req.role {
            Some(r) => MovieRole::try_from(r.as_str())?,
            None => MovieRole::Viewer,
        };

        let member = MovieMember {
            movie_id: movie_id.clone(),
            user_id: req.user_id,
            role,
            joined_at: Utc::now(),
        };

        self.movie_repo.add_member(&member).await?;
        Ok(member)
    }

    pub async fn remove_member(
        &self,
        movie_id: &MovieId,
        user_id: &UserId,
        actor: &UserId,
    ) -> Result<(), AppError> {
        self.assert_can_manage_members(movie_id, actor).await?;

        self.movie_repo
            .get_member(movie_id, user_id)
            .await?
            .ok_or_else(MovieError::member_not_found)?;

        self.movie_repo.remove_member(movie_id, user_id).await
    }

    pub async fn list_members(&self, movie_id: &MovieId) -> Result<Vec<MovieMember>, AppError> {
        self.movie_repo
            .get_by_id(movie_id)
            .await?
            .ok_or_else(MovieError::not_found)?;

        self.movie_repo.list_members(movie_id).await
    }

    pub async fn get_user_movies(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError> {
        self.movie_repo.get_user_movies(user_id).await
    }

    // ========================================================================
    // Response enrichment
    // ========================================================================

    pub async fn to_details(&self, movies: &[Movie]) -> Result<Vec<MovieWithDetails>, AppError> {
        let names = self
            .user_repo
            .resolve_names(movies.iter().map(|m| m.created_by.clone()))
            .await?;
        Ok(movies
            .iter()
            .cloned()
            .map(|m| {
                let created_by_name = names.get(&m.created_by).cloned();
                MovieWithDetails {
                    movie: m,
                    created_by_name,
                }
            })
            .collect())
    }

    pub async fn to_detail(&self, movie: Movie) -> Result<MovieWithDetails, AppError> {
        Ok(self
            .to_details(std::slice::from_ref(&movie))
            .await?
            .remove(0))
    }

    pub async fn to_member_details(
        &self,
        members: &[MovieMember],
    ) -> Result<Vec<MovieMemberWithDetails>, AppError> {
        let names = self
            .user_repo
            .resolve_names(members.iter().map(|m| m.user_id.clone()))
            .await?;
        Ok(members
            .iter()
            .cloned()
            .map(|m| {
                let user_name = names.get(&m.user_id).cloned();
                MovieMemberWithDetails {
                    member: m,
                    user_name,
                }
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iam::user::model::UserFilter;
    use crate::iam::user::{User, UserRepository};
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockMovieRepo {
        movies: Mutex<Vec<Movie>>,
        members: Mutex<Vec<MovieMember>>,
    }
    impl MockMovieRepo {
        fn new() -> Self {
            Self {
                movies: Mutex::new(Vec::new()),
                members: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl MovieRepository for MockMovieRepo {
        async fn save(&self, movie: &Movie) -> Result<(), AppError> {
            self.movies.lock().await.push(movie.clone());
            Ok(())
        }
        async fn save_with_owner(
            &self,
            movie: &Movie,
            owner: &MovieMember,
        ) -> Result<(), AppError> {
            self.movies.lock().await.push(movie.clone());
            self.members.lock().await.push(owner.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &MovieId) -> Result<Option<Movie>, AppError> {
            Ok(self
                .movies
                .lock()
                .await
                .iter()
                .find(|m| m.id == *id)
                .cloned())
        }
        async fn find(
            &self,
            opts: &PaginationOptions,
            _filter: &MovieFilter,
        ) -> Result<Paginated<Movie>, AppError> {
            let movies = self.movies.lock().await;
            let total = movies.len() as i64;
            let start = opts.offset() as usize;
            let items: Vec<Movie> = movies
                .iter()
                .skip(start)
                .take(opts.limit() as usize)
                .cloned()
                .collect();
            Ok(Paginated::new(items, opts.page, opts.page_size, total))
        }
        async fn update(&self, movie: &Movie) -> Result<(), AppError> {
            let mut movies = self.movies.lock().await;
            if let Some(m) = movies.iter_mut().find(|m| m.id == movie.id) {
                *m = movie.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &MovieId) -> Result<(), AppError> {
            self.movies.lock().await.retain(|m| m.id != *id);
            Ok(())
        }
        async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError> {
            Ok(self
                .movies
                .lock()
                .await
                .iter()
                .filter(|m| m.created_by == *user_id)
                .cloned()
                .collect())
        }
        async fn add_member(&self, member: &MovieMember) -> Result<(), AppError> {
            self.members.lock().await.push(member.clone());
            Ok(())
        }
        async fn remove_member(
            &self,
            movie_id: &MovieId,
            user_id: &UserId,
        ) -> Result<(), AppError> {
            self.members
                .lock()
                .await
                .retain(|m| !(m.movie_id == *movie_id && m.user_id == *user_id));
            Ok(())
        }
        async fn get_member(
            &self,
            movie_id: &MovieId,
            user_id: &UserId,
        ) -> Result<Option<MovieMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .find(|m| m.movie_id == *movie_id && m.user_id == *user_id)
                .cloned())
        }
        async fn list_members(&self, movie_id: &MovieId) -> Result<Vec<MovieMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .filter(|m| m.movie_id == *movie_id)
                .cloned()
                .collect())
        }
        async fn get_user_movies(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError> {
            let members = self.members.lock().await;
            let movie_ids: Vec<MovieId> = members
                .iter()
                .filter(|m| m.user_id == *user_id)
                .map(|m| m.movie_id.clone())
                .collect();
            let movies = self.movies.lock().await;
            Ok(movies
                .iter()
                .filter(|m| movie_ids.contains(&m.id))
                .cloned()
                .collect())
        }
    }

    struct MockUserRepo {
        users: Mutex<Vec<User>>,
    }
    impl MockUserRepo {
        fn new() -> Self {
            Self {
                users: Mutex::new(Vec::new()),
            }
        }
        fn with_user(user: User) -> Self {
            Self {
                users: Mutex::new(vec![user]),
            }
        }
    }
    #[async_trait::async_trait]
    impl UserRepository for MockUserRepo {
        async fn get_by_id(&self, id: &UserId) -> Result<Option<User>, AppError> {
            Ok(self
                .users
                .lock()
                .await
                .iter()
                .find(|u| u.id == *id)
                .cloned())
        }
        async fn get_by_ids(&self, ids: &[UserId]) -> Result<Vec<User>, AppError> {
            Ok(self
                .users
                .lock()
                .await
                .iter()
                .filter(|u| ids.contains(&u.id))
                .cloned()
                .collect())
        }
        async fn get_by_email(&self, _: &str) -> Result<Option<User>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn save(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn update(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    fn make_user() -> User {
        User::new_with_password("user@example.com".into(), "Test User".into(), "hash".into())
    }

    fn make_svc(movie_repo: MockMovieRepo, user_repo: MockUserRepo) -> MovieService {
        MovieService::new(Arc::new(movie_repo), Arc::new(user_repo))
    }

    fn create_req(title: &str) -> CreateMovieRequest {
        CreateMovieRequest {
            title: title.into(),
            description: Some("A test movie".into()),
            release_year: Some(2024),
            director: Some("Director".into()),
        }
    }

    // ========================================================================
    // create_movie
    // ========================================================================

    #[tokio::test]
    async fn create_movie_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Inception"), user.id.clone())
            .await
            .unwrap();
        assert_eq!(movie.title, "Inception");
        assert_eq!(movie.description.as_deref(), Some("A test movie"));
        assert_eq!(movie.release_year, Some(2024));
        assert_eq!(movie.director.as_deref(), Some("Director"));
        assert_eq!(movie.created_by.as_str(), user.id.as_str());
    }

    #[tokio::test]
    async fn create_movie_user_not_found() {
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::new());
        let err = svc
            .create_movie(create_req("Movie"), UserId::new())
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_movie_empty_title() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let err = svc
            .create_movie(create_req("  "), user.id.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_movie_invalid_year() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let mut req = create_req("Movie");
        req.release_year = Some(1800);
        let err = svc.create_movie(req, user.id.clone()).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_movie
    // ========================================================================

    #[tokio::test]
    async fn get_movie_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let created = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        let found = svc.get_movie(&created.id).await.unwrap();
        assert_eq!(found.title, "Movie");
    }

    #[tokio::test]
    async fn get_movie_not_found() {
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::new());
        let err = svc.get_movie(&MovieId::new()).await.unwrap_err();
        assert_eq!(err.code, "movie.not_found");
    }

    // ========================================================================
    // find_movies / list_by_user
    // ========================================================================

    #[tokio::test]
    async fn find_movies_paginated() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        for i in 1..=3 {
            svc.create_movie(create_req(&format!("Movie {i}")), user.id.clone())
                .await
                .unwrap();
        }
        let result = svc
            .find_movies(
                &PaginationOptions {
                    page: 1,
                    page_size: 10,
                },
                &MovieFilter::default(),
            )
            .await
            .unwrap();
        assert_eq!(result.items.len(), 3);
        assert_eq!(result.pagination.total, 3);
    }

    #[tokio::test]
    async fn list_by_user_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        svc.create_movie(create_req("M1"), user.id.clone())
            .await
            .unwrap();
        svc.create_movie(create_req("M2"), user.id.clone())
            .await
            .unwrap();
        let movies = svc.list_by_user(&user.id).await.unwrap();
        assert_eq!(movies.len(), 2);
    }

    // ========================================================================
    // update_movie
    // ========================================================================

    #[tokio::test]
    async fn update_movie_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Old"), user.id.clone())
            .await
            .unwrap();
        let updated = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: Some("New".into()),
                    description: Some("Updated desc".into()),
                    release_year: Some(2025),
                    director: Some("New Director".into()),
                },
                &user.id,
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "New");
        assert_eq!(updated.description.as_deref(), Some("Updated desc"));
        assert_eq!(updated.release_year, Some(2025));
        assert_eq!(updated.director.as_deref(), Some("New Director"));
        assert!(updated.updated_at > movie.updated_at);
    }

    #[tokio::test]
    async fn update_movie_partial() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        let updated = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: Some("Changed".into()),
                    description: None,
                    release_year: None,
                    director: None,
                },
                &user.id,
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "Changed");
        assert_eq!(updated.description.as_deref(), Some("A test movie"));
        assert_eq!(updated.release_year, Some(2024));
    }

    #[tokio::test]
    async fn update_movie_not_found() {
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::new());
        let actor = UserId::new();
        let err = svc
            .update_movie(
                &MovieId::new(),
                UpdateMovieRequest {
                    title: Some("X".into()),
                    description: None,
                    release_year: None,
                    director: None,
                },
                &actor,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_found");
    }

    #[tokio::test]
    async fn update_movie_empty_title() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        let err = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: Some("".into()),
                    description: None,
                    release_year: None,
                    director: None,
                },
                &user.id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn update_movie_invalid_year() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        let err = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: None,
                    description: None,
                    release_year: Some(3000),
                    director: None,
                },
                &user.id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // delete_movie
    // ========================================================================

    #[tokio::test]
    async fn delete_movie_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        svc.delete_movie(&movie.id, &user.id).await.unwrap();
        let err = svc.get_movie(&movie.id).await.unwrap_err();
        assert_eq!(err.code, "movie.not_found");
    }

    #[tokio::test]
    async fn delete_movie_not_found() {
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::new());
        let actor = UserId::new();
        let err = svc.delete_movie(&MovieId::new(), &actor).await.unwrap_err();
        assert_eq!(err.code, "movie.not_found");
    }

    // ========================================================================
    // create_movie auto-adds owner
    // ========================================================================

    #[tokio::test]
    async fn create_movie_adds_owner_member() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), user.id.clone())
            .await
            .unwrap();
        let members = svc.list_members(&movie.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].user_id, user.id);
        assert_eq!(members[0].role, MovieRole::Owner);
    }

    // ========================================================================
    // Membership
    // ========================================================================

    #[tokio::test]
    async fn add_member_success() {
        let owner = make_user();
        let other = User::new_with_password("other@x.com".into(), "Other".into(), "hash".into());
        let other_id = other.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(other);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        let member = svc
            .add_member(
                &movie.id,
                AddMovieMemberRequest {
                    user_id: other_id.clone(),
                    role: Some("SUPERVISOR".into()),
                },
                &owner.id,
            )
            .await
            .unwrap();
        assert_eq!(member.role, MovieRole::Supervisor);
    }

    #[tokio::test]
    async fn add_member_default_role() {
        let owner = make_user();
        let other = User::new_with_password("other@x.com".into(), "Other".into(), "hash".into());
        let other_id = other.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(other);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        let member = svc
            .add_member(
                &movie.id,
                AddMovieMemberRequest {
                    user_id: other_id.clone(),
                    role: None,
                },
                &owner.id,
            )
            .await
            .unwrap();
        assert_eq!(member.role, MovieRole::Viewer);
    }

    #[tokio::test]
    async fn add_member_movie_not_found() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        let err = svc
            .add_member(
                &MovieId::new(),
                AddMovieMemberRequest {
                    user_id: user.id.clone(),
                    role: None,
                },
                &user.id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_found");
    }

    #[tokio::test]
    async fn add_member_user_not_found() {
        let owner = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(owner.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        let err = svc
            .add_member(
                &movie.id,
                AddMovieMemberRequest {
                    user_id: UserId::new(),
                    role: None,
                },
                &owner.id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn add_member_duplicate() {
        let owner = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(owner.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        // Owner is already a member
        let err = svc
            .add_member(
                &movie.id,
                AddMovieMemberRequest {
                    user_id: owner.id.clone(),
                    role: None,
                },
                &owner.id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.member_already_added");
    }

    #[tokio::test]
    async fn remove_member_success() {
        let owner = make_user();
        let other = User::new_with_password("other@x.com".into(), "Other".into(), "hash".into());
        let other_id = other.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(other);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        svc.add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: other_id.clone(),
                role: None,
            },
            &owner.id,
        )
        .await
        .unwrap();
        svc.remove_member(&movie.id, &other_id, &owner.id)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn remove_member_not_found() {
        let owner = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(owner.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        let err = svc
            .remove_member(&movie.id, &UserId::new(), &owner.id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.member_not_found");
    }

    #[tokio::test]
    async fn list_members_success() {
        let owner = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(owner.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        let members = svc.list_members(&movie.id).await.unwrap();
        assert_eq!(members.len(), 1); // Owner auto-added
    }

    #[tokio::test]
    async fn get_user_movies_success() {
        let user = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(user.clone()));
        svc.create_movie(create_req("M1"), user.id.clone())
            .await
            .unwrap();
        svc.create_movie(create_req("M2"), user.id.clone())
            .await
            .unwrap();
        let movies = svc.get_user_movies(&user.id).await.unwrap();
        assert_eq!(movies.len(), 2);
    }

    // ========================================================================
    // Authorization
    // ========================================================================

    #[tokio::test]
    async fn update_movie_viewer_denied() {
        let owner = make_user();
        let viewer = User::new_with_password("viewer@x.com".into(), "Viewer".into(), "hash".into());
        let viewer_id = viewer.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(viewer);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        svc.add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: viewer_id.clone(),
                role: Some("VIEWER".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();

        let err = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: Some("Nope".into()),
                    description: None,
                    release_year: None,
                    director: None,
                },
                &viewer_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_authorized");
    }

    #[tokio::test]
    async fn update_movie_non_member_denied() {
        let owner = make_user();
        let svc = make_svc(MockMovieRepo::new(), MockUserRepo::with_user(owner.clone()));
        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();

        let outsider = UserId::new();
        let err = svc
            .update_movie(
                &movie.id,
                UpdateMovieRequest {
                    title: Some("Nope".into()),
                    description: None,
                    release_year: None,
                    director: None,
                },
                &outsider,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_authorized");
    }

    #[tokio::test]
    async fn delete_movie_non_owner_denied() {
        let owner = make_user();
        let editor = User::new_with_password("editor@x.com".into(), "Editor".into(), "hash".into());
        let editor_id = editor.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(editor);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        svc.add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: editor_id.clone(),
                role: Some("EDITOR".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();

        let err = svc.delete_movie(&movie.id, &editor_id).await.unwrap_err();
        assert_eq!(err.code, "movie.not_authorized");
    }

    #[tokio::test]
    async fn add_member_by_viewer_denied() {
        let owner = make_user();
        let viewer = User::new_with_password("viewer@x.com".into(), "Viewer".into(), "hash".into());
        let viewer_id = viewer.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(viewer);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        svc.add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: viewer_id.clone(),
                role: Some("VIEWER".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();

        let err = svc
            .add_member(
                &movie.id,
                AddMovieMemberRequest {
                    user_id: UserId::new(),
                    role: None,
                },
                &viewer_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_authorized");
    }

    #[tokio::test]
    async fn remove_member_by_editor_denied() {
        let owner = make_user();
        let editor = User::new_with_password("editor@x.com".into(), "Editor".into(), "hash".into());
        let editor_id = editor.id.clone();
        let user_repo = MockUserRepo::new();
        user_repo.users.lock().await.push(owner.clone());
        user_repo.users.lock().await.push(editor);
        let svc = make_svc(MockMovieRepo::new(), user_repo);

        let movie = svc
            .create_movie(create_req("Movie"), owner.id.clone())
            .await
            .unwrap();
        svc.add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: editor_id.clone(),
                role: Some("EDITOR".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();

        let err = svc
            .remove_member(&movie.id, &owner.id, &editor_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "movie.not_authorized");
    }
}
