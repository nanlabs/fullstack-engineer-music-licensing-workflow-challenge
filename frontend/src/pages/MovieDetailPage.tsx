
import { MovieWorkspace } from "../components/MovieWorkspace"
import { useParams } from "react-router-dom"
import { useMovieDetail } from "../hooks/useMovieDetail"

export default function MovieDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { movie, loading, error } = useMovieDetail(id!)

    if (loading) {
        return <div>Loading...</div>
    }

    if (error) {
        return <div>Error: {error}</div>
    }

    if (!movie) {
        return <div>Movie not found</div>
    }

    return movie && <MovieWorkspace key={movie.id} movie={movie} />
}