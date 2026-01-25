# Testing

## Running Tests

### Unit Tests
Run all unit tests:
```bash
npm test
```

Run tests in watch mode (for development):
```bash
npm run test:watch
```

Run tests with coverage report:
```bash
npm run test:cov
```

### End-to-End Tests
Run end-to-end tests:
```bash
npm run test:e2e
```

## Test Structure

All unit tests are located in the `tests/` folder at the project root, maintaining the same directory structure as `src/`:

```
tests/
├── common/                    # Common utilities tests
│   ├── filters/
│   ├── interceptors/
│   └── middleware/
│       ├── request-id.middleware.spec.ts
│       └── timeout.middleware.spec.ts
├── health/
│   ├── health.controller.spec.ts
│   └── health.service.spec.ts
├── movies/
├── scenes/
├── songs/
├── tracks/
└── realtime/
    ├── realtime.controller.spec.ts
    └── realtime.service.spec.ts
```

## Test Coverage

The project aims for comprehensive test coverage including:
- **Controllers**: All REST endpoints (Movies, Scenes, Songs, Tracks, Health, Realtime)
- **Services**: Business logic and data operations (including HealthService)
- **Filters**: Exception handling (AllExceptionsFilter, HttpExceptionFilter)
- **Interceptors**: Request/response transformation and logging
- **Middleware**: Request processing (RequestIdMiddleware, TimeoutMiddleware)
- **Real-time Services**: SSE event emission and connection management

## Writing Tests

Tests are written using Jest and follow NestJS testing best practices:

- Use `Test.createTestingModule()` to create test modules
- Mock dependencies using `useValue` or `useClass`
- Test both success and error scenarios
- Verify interactions with mocked services

Example test structure:
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockRepository: MockRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: Repository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more test cases...
});
```
