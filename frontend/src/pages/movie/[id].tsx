'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Box, Button, Card, CardActions, CardContent, Container, Grid, Typography } from '@mui/material';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { useScenes } from '@/hooks/useScenes';

export default function MovieScenesPage() {
  const { id } = useParams();
  const { scenes, loading } = useScenes(id);

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
          color="primary"
          textAlign="center"
          gutterBottom
        >
          <MovieFilterIcon sx={{ mr: 1, fontSize: 34, verticalAlign: 'middle' }} />
          Scenes from the movie {id}
        </Typography>

        <Box textAlign="center" sx={{ mb: 5 }}>
          <Button
            variant="contained"
            color="secondary"
            href="/dashboard"
            sx={{ fontWeight: 'bold', borderRadius: 2, fontSize: '1.1rem' }}
          >
            Go to dashboard
          </Button>
        </Box>

        {loading ? (
          <Typography variant="body1" textAlign="center" color="white">
            Loading...
          </Typography>
        ) : (
          <Grid container spacing={4} justifyContent="center">
            {scenes.map((scene) => (
              <Grid item key={scene.id} xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 3,
                    py: 5,
                    height: '100%',
                    backgroundColor: '#ffffff',
                    boxShadow: 4,
                    borderRadius: 4,
                    textAlign: 'center',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.04)',
                      boxShadow: 8,
                    },
                  }}
                >
                  <CardContent>
                    <MovieFilterIcon color="primary" sx={{ fontSize: 36, mb: 1 }} />
                    <Typography
                      variant="h5"
                      fontWeight="bold"
                      color="primary"
                      sx={{ mb: 1 }}
                    >
                      {scene.name}
                    </Typography>
                    <MusicNoteIcon color="secondary" sx={{ fontSize: 24 }} />
                  </CardContent>
                  <CardActions sx={{ width: '100%', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      color="secondary"
                      component={Link}
                      href={`/scene/${scene.id}`}
                      sx={{
                        fontWeight: 'bold',
                        borderRadius: 2,
                        fontSize: '1rem',
                        px: 3,
                        py: 1,
                      }}
                    >
                      Show tracks
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
