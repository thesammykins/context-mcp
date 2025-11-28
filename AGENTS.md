# AGENTS.md

## Build Commands
- `npm run build` - Clean and build production
- `npm run build:dev` - Development build (no clean)
- `npm run dev` - Watch mode for development
- `npm run test` - Run all tests
- `npm run test:watch` - Watch tests
- `npm run test -- src/__tests__/tools/get-context.test.ts` - Run single test file
- `npm run lint` - Currently no ESLint config

## Code Style Guidelines
- TypeScript with strict mode enabled
- ES2022 target, Node16 modules
- Use `.js` extensions for imports (ESM)
- Vitest for testing with globals enabled
- Test files in `src/__tests__/` with `.test.ts` suffix
- Use Zod for runtime validation
- Error handling with try/catch, console.error for logging
- Follow existing patterns: interfaces in types.ts, tool functions return handlers
- Database operations use better-sqlite3 with proper cleanup in afterEach

## Commit Guidelines
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`
- `feat!` triggers major version bump, `feat:` triggers minor, `fix:` triggers patch
- Commits without conventional types don't trigger releases
- All commits appear in changelog unless marked hidden in release-please config