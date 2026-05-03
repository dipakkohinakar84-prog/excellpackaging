# Graph Report - excell-packaging-erp (29)  (2026-05-02)

## Corpus Check
- 31 files · ~165,626 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 168 nodes · 245 edges · 7 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

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
Cohesion: 0.07
Nodes (19): applyQuickRange(), Card(), clearHint(), downloadCsv(), exportCurrentReport(), getNormalizedAssignedDepartments(), handleDeptToggle(), handleLogin() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (37): ApiError, AppleClientSecretCreateForm, AutodateField, BadRequestError, BoolField, Command, Context, Cookie (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (15): async(), fetchAll(), fetchChildren(), fetchCounts(), fetchData(), fetchReportData(), handleAddChild(), handleDeleteUser() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (8): buildFilter(), escapeFilterValue(), normalizePayload(), normalizeRecord(), PocketBaseChannel, resolveCollectionName(), toError(), toPocketBaseSort()

### Community 4 - "Community 4"
Cohesion: 0.31
Nodes (10): isInvolvingDepartment(), notifyOnce(), canAccessView(), canEditWorkOrder(), filterWorkOrdersByDepartment(), getAllowedStatuses(), normalizeDepartment(), playNotificationSound() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.52
Nodes (5): canEditDepartment(), getDepartmentStatus(), getStatusColor(), handleQCStatusChange(), handleStatusChange()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (2): authenticatePocketBase(), Collection

## Knowledge Gaps
- **37 isolated node(s):** `DynamicModel`, `Context`, `FieldsList`, `Field`, `NumberField` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 6`** (6 nodes): `push-relay.mjs`, `authenticatePocketBase()`, `buildDepartmentFilter()`, `escapeFilterValue()`, `normalizeDepartment()`, `Collection`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Collection` connect `Community 6` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.330) - this node is a cross-community bridge._
- **Why does `PocketBaseQuery` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `async()` connect `Community 2` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `fetchData()` (e.g. with `.order()` and `.select()`) actually correct?**
  _`fetchData()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `normalizeDepartment()` (e.g. with `fetchData()` and `handleLogin()`) actually correct?**
  _`normalizeDepartment()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `sendNotification()` (e.g. with `handleSave()` and `handleStatusChange()`) actually correct?**
  _`sendNotification()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `handleSubmit()` (e.g. with `.single()` and `.eq()`) actually correct?**
  _`handleSubmit()` has 4 INFERRED edges - model-reasoned connections that need verification._