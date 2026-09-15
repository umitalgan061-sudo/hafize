# Zamanlanmış Görevler — Test Matrisi

| Alan | Senaryo | Beklenen |
| --- | --- | --- |
| Auth | GET session yok | 401 |
| Auth | POST session yok | 401 |
| Auth | DELETE session yok | 401 |
| Ownership | Başka kullanıcı schedule ID | 404 |
| Create | Geçerli agent | 201 |
| Create | Geçersiz agent | 400 |
| Create | Boş task | 400 |
| Create | 20.001 karakter | 400 |
| Create | Plaintext credential | 400/safe rejection |
| Create | Geçmiş runAt | rejected |
| Create | Geçerli future runAt | scheduled |
| Create | maxAttempts 1 | accepted |
| Create | maxAttempts 5 | accepted |
| Create | maxAttempts >5 | bounded/rejected |
| Capacity | Store full | 503 |
| List | Kayıt yok | empty list |
| List | Kayıt var | owned records |
| Cancel | scheduled | 200/cancelled |
| Cancel | running | 409 |
| Cancel | completed | 409 |
| Cancel | failed | 409 |
| Cancel | cancelled | 409 |
| Cancel | encoded ID | correct target |
| UI | Panel open | dialog visible |
| UI | Panel close | dialog hidden |
| UI | Refresh | GET |
| UI | Create | POST |
| UI | Cancel | DELETE after confirm |
| UI | Template | textarea populated |
| UI | Filter scheduled | only scheduled rows |
| UI | Filter running | only running rows |
| UI | Filter completed | only completed rows |
| UI | Filter failed | only failed rows |
| UI | Filter cancelled | only cancelled rows |
| UI | Unknown status | fallback label |
| UI | Loading | loading message |
| UI | Network error | error message |
| UI | 401 | auth message |
| UI | 503 | capacity message |
| UI | 409 | refresh after conflict |
| UI | Duplicate submit | button disabled |
| UI | Long task | bounded preview |
| UI | Long error | bounded error |
| UI | Trace ID | readonly display |
| UX | Open shortcut | Ctrl/Meta+Shift+T |
| UX | Typing shortcut | no modal |
| UX | Escape | close |
| UX | Focus restore | prior element |
| Accessibility | Dialog label | exposed |
| Accessibility | Labels | all controls named |
| Accessibility | Live region | status announced |
| Accessibility | Focus ring | visible |
| Accessibility | Reduced motion | supported |
| Accessibility | Forced colors | supported |
| Mobile | <=650px | single column |
| Mobile | Modal | within viewport |
| Mobile | List | scrollable |
| PWA | CSS asset | shell cache |
| PWA | JS asset | shell cache |
| PWA | Keyboard asset | shell cache |
| PWA | Countdown asset | shell cache |
| PWA | API | network-only |
| PWA | Cache version | incremented |
| Privacy | Task content | no client storage |
| Privacy | Schedule token | absent |
| Privacy | URL | no task body |
| Privacy | Console | no task body log |
| Security | DOM rendering | textContent |
| Security | Eval | absent |
| Security | New Function | absent |
| Security | Owner filtering | server-side |
| Performance | Max rows | bounded |
| Performance | Polling | panel only |
| Performance | Close | timer cleanup |
| Performance | Pending GET | abortable |
| Regression | Composer | unchanged |
| Regression | Prompt Library | unchanged |
| Regression | Conversation Workspace | unchanged |
| Regression | Sidebar | unchanged |
| Regression | Theme | compatible |
| Rollback | Client revert | data preserved |
| Rollback | Service worker | cache updated |
| Release | Tests | all required gates |

## Gate rules

Security failures block release.

Ownership failures block release.

PWA API caching failures block release.

Accessibility blockers block release.

Client syntax failures block release.

Functional failures block release.
