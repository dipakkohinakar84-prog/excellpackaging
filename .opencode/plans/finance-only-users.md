# Create Finance-Only Users (Expense Adder + Expense Approver)

## Files to Edit

### 1. `src/App.tsx` — Move Parties nav item from Masters to Finance

Remove from Masters group (around line 12200):
```
{ id: 'parties' as AppView, label: 'Parties', icon: Phone },
```

Add to Finance group (around line 12224):
```
{ id: 'parties' as AppView, label: 'Parties', icon: Phone },
{ id: 'expenses' as AppView, label: 'Expenses', icon: IndianRupee },
```
becomes:
```
{ id: 'expenses' as AppView, label: 'Expenses', icon: IndianRupee },
{ id: 'parties' as AppView, label: 'Parties', icon: Phone },
```

### 2. `src/utils.ts` — Add Finance department mapping + guard unconditional views

**Add to normalizeDepartment mapping** (after line 28 `'despatch': 'Dispatch'`):
```
'finance': 'Finance',
```

**Modify unconditional worker-dashboard/my-tasks access** (line 105):
Change from:
```
if (view === 'worker-dashboard' || view === 'my-tasks') return true;
```
To:
```
// Move normDept before this check
const normDept = normalizeDepartment(user.department);
if ((view === 'worker-dashboard' || view === 'my-tasks') && normDept !== 'Finance') return true;
```

This requires moving `const normDept = normalizeDepartment(user.department);` from line 107 to before line 105.

### 3. No other code changes needed

The permission system already:
- Filters nav items via `canAccess()` → `canAccessView()` in `App.tsx:12230`
- Grants access to expenses/parties via the existing override at `App.tsx:12125-12127`
- Uses explicit flag checks in `canAccessView` at `utils.ts:113-119`

## User Creation (manual via Users screen in app)

### Expense Adder
| Field | Value |
|---|---|
| Department | `Finance` |
| Level | `Staff` |
| Permissions | Only **Add Expenses** = ON |
| All other permissions | OFF |

### Expense Approver
| Field | Value |
|---|---|
| Department | `Finance` |
| Level | `Staff` |
| Permissions | Only **Approve Expenses** = ON |
| All other permissions | OFF |

## What each user sees after login

- **Finance section** in sidebar with Expenses and Parties items
- **No other nav items** (no Dashboard, Orders, Masters, etc.)
- ExpensesView: Expense Adder sees "Add" button + "My Expenses" tab; Expense Approver sees approvals tab
- PartiesView: Full read/write access (both users)
