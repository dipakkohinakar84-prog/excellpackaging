# Graph Report - excell-packaging-erp (29)  (2026-05-03)

## Corpus Check
- 18 files · ~46,917 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 119 nodes · 207 edges · 11 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `PocketBaseQuery` - 14 edges
2. `fetchData()` - 13 edges
3. `normalizeDepartment()` - 11 edges
4. `sendNotification()` - 8 edges
5. `handleSubmit()` - 7 edges
6. `handleSave()` - 7 edges
7. `async()` - 7 edges
8. `fetchCounts()` - 6 edges
9. `fetchAll()` - 6 edges
10. `handleSaveUser()` - 5 edges

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
Cohesion: 0.18
Nodes (15): async(), fetchAll(), fetchChildren(), fetchCounts(), fetchData(), fetchReportData(), handleAddChild(), handleDeleteUser() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (1): openComponentManager()

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (8): buildFilter(), escapeFilterValue(), normalizePayload(), normalizeRecord(), PocketBaseChannel, resolveCollectionName(), toError(), toPocketBaseSort()

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (10): isInvolvingDepartment(), notifyOnce(), canAccessView(), canEditWorkOrder(), filterWorkOrdersByDepartment(), getAllowedStatuses(), normalizeDepartment(), playNotificationSound() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (8): Card(), handleDeptToggle(), handleLogin(), handleLogout(), handlePrint(), LoadingState(), Modal(), toggleDeptSelection()

### Community 5 - "Community 5"
Cohesion: 0.52
Nodes (5): canEditDepartment(), getDepartmentStatus(), getStatusColor(), handleQCStatusChange(), handleStatusChange()

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (2): clearHint(), onPopState()

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): applyQuickRange(), toIsoDate()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (2): getNormalizedAssignedDepartments(), parseAssignedDepartments()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): inRange(), parseDate()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): downloadCsv(), exportCurrentReport()

## Knowledge Gaps
- **Thin community `Community 1`** (20 nodes): `addComponentToSelection()`, `applySortGeneric()`, `getOrderDate()`, `getPageSlice()`, `handleInstallApp()`, `handleNavClick()`, `handleResize()`, `handleSort()`, `isPendingQC()`, `makeLocalId()`, `onAppInstalled()`, `onBeforeInstallPrompt()`, `openComponentManager()`, `openEditorFromPrint()`, `removeComponentFromSelection()`, `SortIcon()`, `sortStatuses()`, `toggleDepartment()`, `updateComponentQty()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (2 nodes): `clearHint()`, `onPopState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `applyQuickRange()`, `toIsoDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (2 nodes): `getNormalizedAssignedDepartments()`, `parseAssignedDepartments()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `inRange()`, `parseDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `downloadCsv()`, `exportCurrentReport()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PocketBaseQuery` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `sendNotification()` connect `Community 3` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `normalizeDepartment()` connect `Community 3` to `Community 0`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `fetchData()` (e.g. with `.order()` and `.select()`) actually correct?**
  _`fetchData()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `normalizeDepartment()` (e.g. with `fetchData()` and `handleLogin()`) actually correct?**
  _`normalizeDepartment()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `sendNotification()` (e.g. with `handleSave()` and `handleStatusChange()`) actually correct?**
  _`sendNotification()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `handleSubmit()` (e.g. with `.single()` and `.eq()`) actually correct?**
  _`handleSubmit()` has 4 INFERRED edges - model-reasoned connections that need verification._