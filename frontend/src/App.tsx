import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth'
import { RequireAuth } from '@/components/require-auth'
import { LoginPage } from '@/pages/login'
import { StudioLayout } from '@/pages/studio/layout'
import { StudioDashboardPage } from '@/pages/studio/dashboard'
import { StudioMoviesPage } from '@/pages/studio/movies-list'
import { StudioMovieDetailPage } from '@/pages/studio/movie-detail'
import { StudioSceneDetailPage } from '@/pages/studio/scene-detail'
import { StudioLicensesPage } from '@/pages/studio/licenses-list'
import { StudioLicenseDetailPage } from '@/pages/studio/license-detail'
import DesignSystemPage from '@/pages/design-system'
import { RightsLayout } from '@/pages/rights/layout'
import { RightsDashboardPage } from '@/pages/rights/dashboard'
import { RightsCatalogPage } from '@/pages/rights/catalog'
import { RightsSongDetailPage } from '@/pages/rights/song-detail'
import { RightsInboxPage } from '@/pages/rights/inbox'
import { RightsLicenseDetailPage } from '@/pages/rights/license-detail'
import { RightsMembersPage } from '@/pages/rights/members'

export default function App() {
  return (
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark">
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/studio" replace />} />
              <Route path="/studio" element={<RequireAuth><StudioLayout /></RequireAuth>}>
                <Route index element={<StudioDashboardPage />} />
                <Route path="movies" element={<StudioMoviesPage />} />
                <Route path="movies/:movieId" element={<StudioMovieDetailPage />} />
                <Route path="movies/:movieId/scenes/:sceneId" element={<StudioSceneDetailPage />} />
                <Route path="licenses" element={<StudioLicensesPage />} />
                <Route path="licenses/:licenseId" element={<StudioLicenseDetailPage />} />
              </Route>
              <Route path="/rights" element={<RequireAuth><RightsLayout /></RequireAuth>}>
                <Route index element={<RightsDashboardPage />} />
                <Route path="catalog" element={<RightsCatalogPage />} />
                <Route path="catalog/:songId" element={<RightsSongDetailPage />} />
                <Route path="inbox" element={<RightsInboxPage />} />
                <Route path="licenses/:licenseId" element={<RightsLicenseDetailPage />} />
                <Route path="members" element={<RightsMembersPage />} />
              </Route>
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="*" element={<Navigate to="/studio" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </TooltipProvider>
  )
}
