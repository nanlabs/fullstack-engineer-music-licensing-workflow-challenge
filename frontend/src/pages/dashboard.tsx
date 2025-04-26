'use client';

import Link from 'next/link';
import { Box, Grid, Card, CardActions, Typography, Container, Button } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { useMovies } from '@/hooks/useMovies';

export default function Home() {
  const { movies, loading } = useMovies();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to right, #1f1f1f, #434343)',
        py: 6,
      }}
    >
      <Container maxWidth="xl">
        <Typography
          variant="h3"
          fontWeight="bold"
          textAlign="center"
          gutterBottom
          color="primary"
        >
          <MovieIcon sx={{ mr: 1, fontSize: 36, verticalAlign: 'middle' }} />
          Available movies
        </Typography>

        {loading ? (
          <Typography variant="body1" textAlign="center" color="white">
            Cargando...
          </Typography>
        ) : (
          <Grid container spacing={4} justifyContent="center" sx={{ mt: '1.4rem' }}>
            {movies.map((movie) => (
              <Grid item key={movie.id} xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxShadow: 5,
                    borderRadius: 4,
                    px: 3,
                    py: 4,
                    backgroundColor: '#ffffff',
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 10,
                    },
                  }}
                >
                  <Box>
                    <MovieIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="primary"
                      sx={{ mb: 1 }}
                    >
                      {movie.title}
                    </Typography>
                    <Typography
                      variant="h5"
                      color="text.secondary"
                      sx={{
                        px: 1,
                        minHeight: '3.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {movie.description || '-'}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 1 }}>
                    <MusicNoteIcon color="secondary" sx={{ fontSize: 28, my: 1 }} />

                    <CardActions sx={{ width: '100%', justifyContent: 'center' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        color="secondary"
                        component={Link}
                        href={`/movie/${movie.id}`}
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          py: 1.2,
                          borderRadius: 2,
                        }}
                      >
                        Show scenes
                      </Button>
                    </CardActions>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
