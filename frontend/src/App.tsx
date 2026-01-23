import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

import MoviesPage from './pages/MoviesPage';
import MovieDetailPage from './pages/MovieDetailPage';

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Header title="Music Licensing" />
          <main className="w-full flex-1">
            <Routes>
              <Route path="/" element={<MoviesPage />} />
              <Route path="/movies/:id" element={<MovieDetailPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </>
  );
}

export default App
