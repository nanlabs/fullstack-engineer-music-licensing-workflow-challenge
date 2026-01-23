import type { Scene } from "./scene";

export interface Movie {
    id: string;
    title: string;
    releaseDate: Date;
    scenes: Scene[];
}