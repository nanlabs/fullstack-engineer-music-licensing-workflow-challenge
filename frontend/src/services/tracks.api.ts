import { env } from "../config/env"
import type { Track } from "../types/track"

export async function fetchTracks(): Promise<Track[]> {
  const res = await fetch(`${env.apiBaseUrl}/tracks`)
  if (!res.ok) {
    throw new Error("Failed to fetch tracks")
  }
  return res.json()
}

export async function updateTrackLicensingStatus(id: string, status: string): Promise<Track> {
  const res = await fetch(`${env.apiBaseUrl}/tracks/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    throw new Error("Failed to update track licensing status")
  }
  return res.json()
}