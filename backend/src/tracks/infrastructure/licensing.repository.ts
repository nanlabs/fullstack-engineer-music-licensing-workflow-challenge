import { LICENSE_TRANSITIONS, LicensingTransitionRepository, NextState } from "../domain/transition.interface";
import { Injectable } from "@nestjs/common";
import { LicensingStatus } from '@prisma/client';

@Injectable()
export class LicensingRepository implements LicensingTransitionRepository {
    canTransition<From extends LicensingStatus>(from: From, to: LicensingStatus): to is NextState<From> {
        return (LICENSE_TRANSITIONS[from] as readonly LicensingStatus[]).includes(to)
    }
}