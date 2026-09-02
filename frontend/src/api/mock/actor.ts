let mockActorId: string | null = null

export function setMockActorId(actorId: string | null) {
  mockActorId = actorId
}

export function getMockActorId(): string | null {
  return mockActorId
}
