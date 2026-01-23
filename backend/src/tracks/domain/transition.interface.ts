import { LicensingStatus } from '@prisma/client';

export const LICENSE_TRANSITIONS = {
    PENDING: [LicensingStatus.NEGOTIATING],
    NEGOTIATING: [LicensingStatus.APPROVED, LicensingStatus.REJECTED],
    APPROVED: [],
    REJECTED: [],
} as const;

type Transitions = typeof LICENSE_TRANSITIONS;

export type NextState<S extends LicensingStatus> = Transitions[S][number];

export interface LicensingTransitionRepository {
    canTransition<From extends LicensingStatus>(
        from: From,
        to: LicensingStatus,
    ): to is NextState<From>;
}