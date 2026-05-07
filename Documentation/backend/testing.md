# Backend Testing Strategy

The backend test suite is written using **Mocha** as the test runner and **Chai** for assertions, utilizing **Supertest** to test the API endpoints directly.

## Running the Tests
Tests can be executed by running the following command in the `backend/` directory:
```bash
npm run test
```
This script triggers `mocha "test/**/*.test.mjs" --timeout 5000`.

## Test Architecture
- **In-Memory Database**: To keep tests isolated and fast, `test/testApp.mjs` configures an in-memory SQLite database (`:memory:`). The schema is explicitly recreated for each test suite, guaranteeing a clean state.
- **API Mocks**: The `makeTestApp(db)` function in `testApp.mjs` spins up a lightweight Express server purely for testing and mounts the routers you want to test (e.g., `authRoutes`, `podRoutes`).
- **Data Generation**: Scripts like `test/generateTestData.js` and `test/testDataLoader.js` allow for rapid population of complex mocked data (users, pods, sensor data) from JSON fixtures (e.g., `testDataPeople.json`, `testDataPodData.json`).

## Dependencies
- **devDependencies**: `mocha`, `chai`, `supertest`.
- **Promises Setup**: In-memory database methods are wrapped using `util.promisify` inside the test setup to allow tests to use modern `async/await` syntax smoothly without refactoring the core callback-based SQLite implementations.