// The single logged-in user for the mock-data phase (login is out of
// scope for now — see App.tsx). Fixed to the movie supervisor so every
// Studio view has a consistent actor for permission checks and
// "created by me" filtering.

import { USERS } from '@/api/mock/data'

export const CURRENT_USER = USERS.supervisor
