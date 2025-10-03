import { LicenseHistory } from '@/src/contexts/license-history/domain/license-history.entity'
import { Licenses } from '@/src/contexts/licenses/domain/licenses.entity'
import { Movies } from '@/src/contexts/movies/domain/movies.entity'
import { Scenes } from '@/src/contexts/scenes/domain/scenes.entity'
import { Tracks } from '@/src/contexts/tracks/domain/tracks.entity'
import { Songs } from '@/src/contexts/songs/domain/songs.entity'

export const getEntities = () => {
  return [Movies, Scenes, Licenses, LicenseHistory, Songs, Tracks]
}
