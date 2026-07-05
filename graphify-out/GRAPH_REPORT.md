# Graph Report - excell-packaging-erp (29)  (2026-06-24)

## Corpus Check
- 27 files · ~88,809 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 252 nodes · 472 edges · 16 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 127 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `fetchData()` - 19 edges
2. `normalizeDepartment()` - 17 edges
3. `async()` - 15 edges
4. `PocketBaseQuery` - 15 edges
5. `handleSave()` - 12 edges
6. `invalidateCollectionCache()` - 12 edges
7. `handleSubmit()` - 10 edges
8. `catch()` - 10 edges
9. `sendNotification()` - 9 edges
10. `updateCardStatus()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `invalidateCollectionCache()` --calls--> `invalidateCachedData()`  [INFERRED]
  src\App.tsx → src\dataCache.ts
- `fetchData()` --calls--> `filterWorkOrdersByDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `fetchData()` --calls--> `normalizeDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `handleSave()` --calls--> `sendNotification()`  [INFERRED]
  src\App.tsx → src\utils.ts
- `async()` --calls--> `normalizeDepartment()`  [INFERRED]
  src\App.tsx → src\utils.ts

## Communities

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (33): addMissingComponentsFromSearch(), alertBomDeleteBlocked(), async(), deleteComponent(), deleteCustomer(), deleteItem(), fetchData(), getBomParentReferences() (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (18): catch(), loadUser(), handleLoginAfterVerify(), buildFilter(), ensureLegacyId(), escapeFilterValue(), getCurrentAuthUser(), getNextLegacyId() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (12): addExpandedBomComponents(), fetchAll(), fetchCounts(), fetchReportData(), onError(), openComponentManager(), runOneTimeBackfill(), handleLogin() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (19): buildDepartmentStatusUpdate(), deriveDepartmentStatusesFromOverallStatus(), deriveOverallStatusFromDepartmentStatuses(), getCardStatusOptions(), getEditableDepartmentForUser(), isCardStatusCurrent(), isInvolvingDepartment(), isSequentialOnly() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (9): Card(), fetchChildren(), handleAddChild(), handleDeptToggle(), handleLogin(), handleLogout(), LoadingState(), Modal() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (5): canEditDepartment(), getDepartmentStatus(), getStatusColor(), handleQCStatusChange(), handleStatusChange()

### Community 7 - "Community 7"
Cohesion: 0.32
Nodes (6): loadCachedCollection(), primeCachedCollection(), getCachedData(), invalidateCachedData(), loadAndStore(), primeCachedData()

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (2): authenticatePocketBase(), describeError()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (1): confirmStatusChange()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): inRange(), parseDate()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): getNormalizedAssignedDepartments(), parseAssignedDepartments()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): applySortGeneric(), exportPdfReport()

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): getBomChildType(), toBomSelectionRow()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): applyQuickRange(), toIsoDate()

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (2): addItemToSelection(), itemContainsItem()

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (2): clearHint(), onPopState()

## Knowledge Gaps
- **Thin community `Community 8`** (6 nodes): `push-relay.mjs`, `authenticatePocketBase()`, `buildDepartmentFilter()`, `describeError()`, `escapeFilterValue()`, `normalizeDepartment()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (5 nodes): `MyTasks.tsx`, `confirmStatusChange()`, `matchesDate()`, `matchesSearch()`, `normalize()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `inRange()`, `parseDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `getNormalizedAssignedDepartments()`, `parseAssignedDepartments()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `applySortGeneric()`, `exportPdfReport()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `getBomChildType()`, `toBomSelectionRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `applyQuickRange()`, `toIsoDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `addItemToSelection()`, `itemContainsItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `clearHint()`, `onPopState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `catch()` connect `Community 2` to `Community 0`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `normalizeDepartment()` connect `Community 4` to `Community 1`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `PocketBaseQuery` connect `Community 3` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `fetchData()` (e.g. with `.order()` and `.select()`) actually correct?**
  _`fetchData()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `normalizeDepartment()` (e.g. with `fetchData()` and `handleLogin()`) actually correct?**
  _`normalizeDepartment()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `async()` (e.g. with `.eq()` and `.select()`) actually correct?**
  _`async()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `handleSave()` (e.g. with `.insert()` and `sendNotification()`) actually correct?**
  _`handleSave()` has 6 INFERRED edges - model-reasoned connections that need verification._