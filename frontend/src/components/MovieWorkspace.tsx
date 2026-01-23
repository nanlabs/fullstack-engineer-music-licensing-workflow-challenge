import { useState } from 'react';
import { ChevronRight, Film, Music } from 'lucide-react';
import Button from './Button';
import StatusBadge from './StatusBadge';
import type { Track, StatusType } from '../types/track';
import type { Movie } from '../types/movie';
import { updateTrackLicensingStatus } from '../services/tracks.api';
import { useTracksSocket } from '../hooks/useTracksSocket';
import { toast } from 'sonner';

type MovieWorkspaceProps = {
    movie: Movie;
};

export const MovieWorkspace = (props: MovieWorkspaceProps) => {
    const [movie, setMovie] = useState(props.movie);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [newStatus, setNewStatus] = useState('');
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
        movie?.scenes[0]?.id || null
    );

    const selectedScene = movie?.scenes.find((s) => s.id === selectedSceneId);

    const handleOpenModal = (track: Track) => {
        setSelectedTrack(track);
        setNewStatus(track.status);
        setIsModalOpen(true);
    };

    const handleUpdate = async () => {
        if (!selectedTrack) return;
        const promise = updateTrackLicensingStatus(selectedTrack.id, newStatus)
        toast.promise<Track>(promise, {
            loading: 'Updating status...',
            success: () => {
                setIsModalOpen(false);
                return `Licensing status updated successfully`
            },
            error: 'There was an error updating the track',
        })
    };

    const handleRealTimeUpdate = (data: { trackId: string, status: StatusType }) => {
        setMovie(prevMovie => ({
            ...prevMovie,
            scenes: prevMovie.scenes.map(scene => ({
                ...scene,
                tracks: scene.tracks.map(track => 
                track.id === data.trackId 
                    ? { ...track, status: data.status }
                    : track
                )
            }))
        }))
    }

    useTracksSocket(handleRealTimeUpdate)

    return (
        <div className="flex h-[calc(100vh-64px)] bg-slate-50 overflow-hidden">
            {/* Scenes sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Scenes ({movie?.scenes.length})
                </h2>
                </div>
                
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {movie?.scenes.map((scene) => (
                    <button
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                        selectedSceneId === scene.id
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    >
                    <Film size={18} className={selectedSceneId === scene.id ? 'text-blue-600' : 'text-slate-400'} />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">{scene.description}</p>
                        <p className="text-xs opacity-70">Start Time: {scene.startTime}s</p>
                    </div>
                    <ChevronRight size={16} className={selectedSceneId === scene.id ? 'opacity-100' : 'opacity-0'} />
                    </button>
                ))}
                </nav>
            </aside>

            {/* Tracks */}
            <main className="flex-1 overflow-y-auto p-8">
                {selectedScene ? (
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <Music size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">Soundtrack Manager</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">{selectedScene.description}</h1>
                    <p className="text-slate-500">Manage music licenses for this scene.</p>
                    </header>

                    {/* Tracks table */}
                    <div className="bg-white shadow-sm border border-slate-200 overflow-hidden rounded-lg">
                        <table className="w-full text-left border-collapse border-separate">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Track / Song</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Timing</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Tracks loop */}
                                {selectedScene.tracks && selectedScene.tracks.map(track => (
                                    <tr className="hover:bg-slate-50/50 transition-colors" key={track.id}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{track.song?.title}</div>
                                            <div className="text-xs text-slate-500">{track.song?.artist}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {track.startInScene}s - {track.endInScene}s
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={track.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="primary" onClick={() => handleOpenModal(track)}>Update</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                    <p>Select a scene to manage its soundtrack.</p>
                </div>
                )}
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Update License</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Changing Licensing State For: <span className="font-semibold text-slate-700">{selectedTrack?.song?.title}</span>
                        </p>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700">New Status</label>
                            <select 
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
                            >
                                <option value="PENDING">Pending</option>
                                <option value="NEGOTIATING">Negotiating</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleUpdate}>Save</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};