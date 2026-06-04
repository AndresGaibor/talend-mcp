# Presentation Apps Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Talend visual apps layer inside `src/presentation` with a clean, testable architecture that keeps launchers, shell HTML, and initial state resolution separate from domain logic.

**Architecture:** The new layer will live under `src/presentation/apps/` and will expose a small registry that composes app definitions, resource registration, launcher tool registration, and `initialState` resolvers. Presentation code will only adapt data from existing Talend services and use cases; it will not own business rules. Heavy environment diagnostics will remain isolated to explicit screens such as `environment-doctor`, while `home` and `dashboard` will use lightweight snapshots.

**Tech Stack:** Bun, TypeScript, MCP server APIs, existing Talend services/use cases, and the current test suite.

### Task 1: Define the presentation app model

**Files:**
- Create: `src/presentation/apps/app-types.ts`
- Create: `src/presentation/apps/app-shell.ts`
- Create: `src/presentation/apps/app-state.ts`

**Step 1: Write the failing test**

Add tests that assert the app model can describe an app id, actions, launch payload metadata, and a lightweight `home` initial state.

**Step 2: Run test to verify it fails**

Run: `bun test tests/talend/apps.test.ts`
Expected: FAIL because the new presentation app modules do not exist yet.

**Step 3: Write minimal implementation**

Implement the typed app definition model, shared shell HTML generator, and app-specific initial state resolver with a cheap default snapshot.

**Step 4: Run test to verify it passes**

Run: `bun test tests/talend/apps.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/presentation/apps/app-types.ts src/presentation/apps/app-shell.ts src/presentation/apps/app-state.ts tests/talend/apps.test.ts
git commit -m "feat: rebuild presentation app model"
```

### Task 2: Rebuild the app registry

**Files:**
- Create: `src/presentation/apps/app-registry.ts`
- Modify: `src/presentation/server/new-server.ts`
- Modify: `src/presentation/tools/registry.ts` if needed for shared payload helpers

**Step 1: Write the failing test**

Add smoke coverage that the server can register app resources and launcher tools from the presentation registry.

**Step 2: Run test to verify it fails**

Run: `bun test tests/talend/server-smoke.test.ts`
Expected: FAIL until the new registry is wired in.

**Step 3: Write minimal implementation**

Implement the registry and wire it into the presentation server so app resources and launchers are registered from one place.

**Step 4: Run test to verify it passes**

Run: `bun test tests/talend/server-smoke.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/presentation/apps/app-registry.ts src/presentation/server/new-server.ts src/presentation/tools/registry.ts tests/talend/server-smoke.test.ts
git commit -m "feat: wire presentation app registry"
```

### Task 3: Restore launcher payloads and tests

**Files:**
- Create or modify: `tests/talend/apps.test.ts`
- Modify: `src/presentation/apps/app-registry.ts`

**Step 1: Write the failing test**

Add tests for the launcher payload structure, `summary`, app-specific `initialState`, and the fast `home` path.

**Step 2: Run test to verify it fails**

Run: `bun test tests/talend/apps.test.ts`
Expected: FAIL until the registry and resolvers produce the expected payloads.

**Step 3: Write minimal implementation**

Fill in the launcher tool payload builders and the app-specific state resolver.

**Step 4: Run test to verify it passes**

Run: `bun test tests/talend/apps.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/presentation/apps/app-registry.ts tests/talend/apps.test.ts
git commit -m "feat: restore presentation launcher payloads"
```

### Task 4: Final verification and cleanup

**Files:**
- Modify: any remaining imports and exports across `src/`

**Step 1: Run the full targeted checks**

Run:
```bash
bun test tests/talend/apps.test.ts tests/talend/server-smoke.test.ts
bunx tsc --noEmit
```

**Step 2: Fix any regressions**

Keep changes local to `src/presentation` unless a broken import requires a small follow-up update.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: rebuild presentation apps layer"
```
