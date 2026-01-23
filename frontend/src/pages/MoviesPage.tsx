import { Film, EyeIcon } from 'lucide-react';
import { useMovies } from "../hooks/useMovies"
import { Grid } from "../components/Grid"

export default function Movies() {
    const fields = [
        { label: 'Title', render: (m: any) => m.title },
        { label: 'Release Date', render: (m: any) => new Date(m.releaseDate).toLocaleDateString() },
        { label: 'Created At', render: (m: any) => new Date(m.createdAt).toLocaleDateString()},
        { label: 'Actions', render: (m: any) => <a href={`/movies/${m.id}`} className="text-blue-600 hover:underline cursor-pointer"><EyeIcon size={20} /></a> },
    ]

    const { movies, loading, error } = useMovies()

    if (loading) return <p>Loading...</p>
    if (error) return <p>{error}</p>

    return (
        <main className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Film size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Catalog System</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Manage Movies
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                    Track your cinematic productions and music licensing assets.
                    </p>
                </div>
            </div>
            <Grid
                items={movies}
                fields={fields}
                getKey={m => m.id}
            />
        </main>
    )
}