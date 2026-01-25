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
├── health/
├── movies/
├── scenes/
├── songs/
├── tracks/
└── realtime/
```

## Test Coverage

The project aims for comprehensive test coverage including:
- **Controllers**: All REST endpoints
- **Services**: Business logic and data operations
- **Filters**: Exception handling
- **Interceptors**: Request/response transformation and logging
- **Middleware**: Request processing
- **Real-time Services**: SSE event emission

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
