# Graph Report - excell-packaging-erp (29)  (2026-05-04)

## Corpus Check
- 18 files · ~47,800 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 127 nodes · 224 edges · 11 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `PocketBaseQuery` - 14 edges
2. `fetchData()` - 13 edges
3. `normalizeDepartment()` - 11 edges
4. `PocketBaseChannel` - 9 edges
5. `sendNotification()` - 8 edges
6. `handleSubmit()` - 7 edges
7. `handleSave()` - 7 edges
8. `async()` - 7 edges
9. `fetchCounts()` - 6 edges
10. `fetchAll()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `fetchData()` --calls--> `filterWorkOrdersByDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `fetchData()` --calls--> `normalizeDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `handleSave()` --calls--> `sendNotification()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `async()` --calls--> `normalizeDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `handleLogin()` --calls--> `normalizeDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (16): async(), fetchAll(), fetchChildren(), fetchCounts(), fetchData(), fetchReportData(), handleAddChild(), handleDeleteUser() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (10): buildFilter(), ensureLegacyId(), escapeFilterValue(), getNextLegacyId(), isValidLegacyId(), normalizePayload(), normalizeRecord(), resolveCollectionName() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (10): isInvolvingDepartment(), notifyOnce(), canAccessView(), canEditWorkOrder(), filterWorkOrdersByDepartment(), getAllowedStatuses(), normalizeDepartment(), playNotificationSound() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (8): Card(), handleDeptToggle(), handleLogin(), handleLogout(), handlePrint(), LoadingState(), Modal(), toggleDeptSelection()

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (1): PocketBaseChannel

### Community 6 - "Community 6"
Cohesion: 0.52
Nodes (5): canEditDepartment(), getDepartmentStatus(), getStatusColor(), handleQCStatusChange(), handleStatusChange()

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): getNormalizedAssignedDepartments(), parseAssignedDepartments()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (2): applyQuickRange(), toIsoDate()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): downloadCsv(), exportCurrentReport()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): inRange(), parseDate()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): clearHint(), onPopState()

## Knowledge Gaps
- **Thin community `Community 5`** (10 nodes): `PocketBaseChannel`, `.constructor()`, `.notifyHandlers()`, `.on()`, `.pollTables()`, `.primeCache()`, `.subscribe()`, `.subscribeWithPolling()`, `.unsubscribe()`, `.then()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `getNormalizedAssignedDepartments()`, `parseAssignedDepartments()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (2 nodes): `applyQuickRange()`, `toIsoDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `downloadCsv()`, `exportCurrentReport()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `inRange()`, `parseDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `clearHint()`, `onPopState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PocketBaseQuery` connect `Community 0` to `Community 2`, `Community 5`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `sendNotification()` connect `Community 3` to `Community 0`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `normalizeDepartment()` connect `Community 3` to `Community 0`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `fetchData()` (e.g. with `.order()` and `.select()`) actually correct?**
  _`fetchData()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `normalizeDepartment()` (e.g. with `fetchData()` and `handleLogin()`) actually correct?**
  _`normalizeDepartment()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `sendNotification()` (e.g. with `handleSave()` and `handleStatusChange()`) actually correct?**
  _`sendNotification()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._