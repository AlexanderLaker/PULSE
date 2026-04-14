# PRISM War Room Connection Status Implementation Guide

## Overview

The PRISM War Room now includes a real-time backend connection status indicator in the header. This provides users with visual feedback about the API connection state and allows for manual reconnection attempts.

## Visual States

### 1. Connected (Green)
```
● Connected
```
- **Indicator**: Green dot, solid
- **Label**: "Connected"
- **Behavior**: Backend is live and responsive
- **Health Check**: Runs every 60 seconds
- **User Action**: None required

### 2. Reconnecting (Amber)
```
● Reconnecting... ↻
```
- **Indicator**: Amber dot with pulse animation (1.0 → 1.2 → 1.0 scale)
- **Label**: "Reconnecting..."
- **Icon**: Spinning refresh icon (RotateCw from Lucide)
- **Behavior**: Attempting to restore connection after temporary loss
- **Health Check**: Runs every 30 seconds
- **User Action**: Wait for automatic recovery or click to force retry

### 3. Offline (Red)
```
● Offline ⚠️
(click to retry)
```
- **Indicator**: Red dot, solid
- **Label**: "Offline"
- **Icon**: Alert circle (AlertCircle from Lucide)
- **Hint Text**: "(click to retry)" appears below indicator
- **Behavior**: Backend unreachable; using local mock data
- **Health Check**: Runs every 30 seconds
- **User Action**: Click indicator to manually attempt reconnection

## Implementation Details

### Hook: `usePrism.ts`

#### New State
```typescript
connectionState: 'connected' | 'reconnecting' | 'offline'
```

#### New Methods
```typescript
reconnect(): Promise<void>
// Manually trigger reconnection attempt
```

#### Health Check Schedule
```
Connected:      60 seconds
Offline:        30 seconds (aggressive reconnection)
Reconnecting:   30 seconds
```

#### Health Check Endpoint
```
GET /api/v1/health
```

Returns:
```json
{
  "status": "ok",
  "version": "4.0.0",
  "model_loaded": true,
  "trend_count": 60,
  "categories": 13,
  "has_simulation": true
}
```

### Component: `ConnectionStatus.tsx`

**Props:**
```typescript
interface ConnectionStatusProps {
  state: 'connected' | 'reconnecting' | 'offline';
  onReconnect: () => void;
}
```

**Features:**
- Framer Motion animations for smooth transitions
- Lucide React icons (RotateCw, AlertCircle)
- Design tokens from `lib/format.ts` (T.green, T.amber, T.red)
- Accessibility attributes (role, aria-label, title)
- Responsive styling that adapts to theme

**Styling:**
- Glass-morphism pill design
- Inline flexbox layout
- Subtle background: `rgba(0, 0, 0, 0.02)`
- Border: `1px solid T.border1`
- Padding: `6px 12px`
- Border radius: `20px` (pill shape)

### WarRoom Header Integration

**Position in header:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [Tabs] [Region] [Scenarios] | [Connection] [Stats]   │
└─────────────────────────────────────────────────────────────┘
                                      ↑
                         Positioned after "marginLeft: auto"
```

**Code:**
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
  <ConnectionStatus state={connectionState} onReconnect={reconnect} />
  {/* Convergence badge and iteration count follow */}
</div>
```

## User Workflows

### Scenario 1: Normal Operation
1. Page loads → `connectionState = 'reconnecting'`
2. API responds successfully → `connectionState = 'connected'`
3. User sees green dot with "Connected" label
4. Background health checks run every 60 seconds

### Scenario 2: Temporary Network Interruption
1. Backend goes offline
2. Next health check fails → `connectionState = 'offline'`
3. User sees red dot with "Offline" label and "(click to retry)" hint
4. Background health checks run every 30 seconds (aggressive)
5. When backend recovers, health check succeeds → back to 'connected'
6. **No user action needed** — automatic recovery

### Scenario 3: Manual Reconnection
1. User sees "Offline" indicator
2. User clicks the indicator
3. `connectionState = 'reconnecting'` with spinning icon
4. `reconnect()` function calls `loadAll()` again
5. If successful → 'connected', if failed → 'offline' with retry hint
6. Background continues 30-second health checks

### Scenario 4: Graceful Degradation
1. Backend unavailable
2. WarRoom automatically generates mock data
3. All calculations use local data
4. ConnectionStatus clearly shows offline state
5. When backend returns, data syncs automatically

## API Integration

### Health Check Flow
```
┌─────────────┐
│   WarRoom   │
│  (React)    │
└──────┬──────┘
       │ GET /api/v1/health (every 30-60s)
       ▼
┌─────────────────────────────┐
│   FastAPI Backend           │
│   (localhost:8000)          │
└─────────────────────────────┘
       │
       │ Response: 200 OK
       │ {status, version, model_loaded, ...}
       ▼
┌─────────────┐
│ Update UI   │
│  'connected'│
└─────────────┘
```

### Error Handling
```
Network Error (TypeError: "Failed to fetch")
       ▼
ApiError(0, "Backend unavailable or network error")
       ▼
catch handler in usePrism.ts
       ▼
setConnectionState('offline')
generateMockSimulation()
scheduleeHealthCheck(30s)
```

## CORS Configuration

### Development
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ENV=development
```

Allows:
- React dev server on port 3000
- Vite dev server on port 5173

### Production
```bash
CORS_ORIGINS=https://pulse.henkel.com
ENV=production
```

Restricts to production domain only (configurable).

## Styling Integration

### Design Tokens Used
```typescript
// From lib/format.ts
T.green    = '#30D158'  // Connected
T.amber    = '#FF9F0A'  // Reconnecting
T.red      = '#FF453A'  // Offline
T.border1  = 'rgba(0,0,0,0.08)'  // Pill border
T.text2    = '#6E6E73'  // Secondary text
T.sans     = "'Inter', -apple-system, BlinkMacSystemFont, ..."
```

### Animations
```javascript
// Pulsing dot when reconnecting
animate={{ scale: [1, 1.2, 1] }}
transition={{ repeat: Infinity, duration: 1.5 }}

// Spinning icon
animate={{ rotate: 360 }}
transition={{ repeat: Infinity, duration: 1 }}
```

## Accessibility

### ARIA Attributes
```jsx
<div
  role="status"
  aria-label={`Backend status: ${statusLabel}`}
  title={description}
>
```

### Screen Reader Experience
- Status updates announced automatically
- Descriptive aria-label explains current state
- Title attribute provides additional context
- Color not used alone — icon and text reinforce meaning

## Performance Considerations

### Memory Management
- Interval ref properly cleaned up on unmount
- No memory leaks from forgotten setInterval calls
- State updates guarded by `mounted.current` check

### Network Efficiency
- Health checks are minimal (GET request, ~100 bytes)
- Only runs periodically, not on every interaction
- Backoff strategy: 60s when healthy, 30s when degraded

### UI Responsiveness
- All animations at 60fps (Framer Motion)
- Transition time: ~200ms for state changes
- No blocking operations during health checks

## Testing Guide

### Manual Testing

#### Test 1: Normal Operation
```bash
# Start backend
python -m pulse.api.app

# Start frontend
npm run dev

# Expected: Green "Connected" indicator in header
```

#### Test 2: Offline Detection
```bash
# With both running and connected:
# 1. Kill backend (Ctrl+C)
# 2. Wait for next health check (< 60s)
# 3. Expected: Indicator turns amber "Reconnecting..."
# 4. After a few seconds: Turns red "Offline"
# 5. "(click to retry)" hint appears
```

#### Test 3: Auto-Recovery
```bash
# With backend offline:
# 1. Verify red "Offline" state
# 2. Restart backend
# 3. Expected: Within 30 seconds, turns green "Connected"
# 4. No user action required
```

#### Test 4: Manual Reconnect
```bash
# With backend offline:
# 1. Click the red indicator
# 2. Expected: Turns amber "Reconnecting..." with spinning icon
# 3. If backend is running: Should recover to green "Connected"
# 4. If backend still offline: Returns to red "Offline"
```

#### Test 5: Health Check Intervals
```bash
# Open DevTools → Network tab
# Connected state: Watch GET /api/v1/health every ~60s
# Offline state: Watch GET /api/v1/health every ~30s
```

### Automated Tests (Jest/Vitest)

```typescript
describe('ConnectionStatus', () => {
  it('renders green dot when connected', () => {
    render(<ConnectionStatus state="connected" onReconnect={jest.fn()} />);
    expect(screen.getByLabelText(/Backend status: Connected/i)).toBeInTheDocument();
  });

  it('renders amber icon when reconnecting', () => {
    render(<ConnectionStatus state="reconnecting" onReconnect={jest.fn()} />);
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it('shows retry hint when offline', () => {
    render(<ConnectionStatus state="offline" onReconnect={jest.fn()} />);
    expect(screen.getByText(/click to retry/i)).toBeInTheDocument();
  });

  it('calls onReconnect when offline indicator clicked', () => {
    const mockReconnect = jest.fn();
    render(<ConnectionStatus state="offline" onReconnect={mockReconnect} />);
    fireEvent.click(screen.getByRole('status'));
    expect(mockReconnect).toHaveBeenCalled();
  });
});

describe('usePrism hook', () => {
  it('tracks connection state changes', async () => {
    const { result } = renderHook(() => usePrism());
    expect(result.current.connectionState).toBe('reconnecting');

    await waitFor(() => {
      expect(result.current.connectionState).toMatch(/connected|offline/);
    });
  });

  it('reconnect function updates connection state', async () => {
    const { result } = renderHook(() => usePrism());
    await result.current.reconnect();
    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });
  });
});
```

## Troubleshooting

### Indicator Shows "Offline" but Backend is Running
1. Check CORS configuration in `pulse/api/app.py`
2. Verify frontend origin is in `allow_origins`
3. Check browser console for CORS errors
4. Ensure `/api/v1/health` endpoint is accessible

### Connection State Not Updating
1. Check React DevTools for hook state
2. Verify `mounted.current` flag is being set
3. Check for interval leaks (DevTools → Performance)
4. Confirm health check endpoint is returning 200

### Health Checks Not Running
1. Open DevTools → Network tab
2. Filter for `/health` requests
3. If no requests: Check if intervals are being cleared
4. Verify hook is properly initialized

### Performance Issues
1. Profile with React DevTools Profiler
2. Check for redundant re-renders
3. Verify intervals are cleaned up on unmount
4. Monitor network tab for excessive health check requests

## Future Enhancements

1. **Persistent Connection Stats**: Track uptime, latency, error rate
2. **Detailed Error Messages**: Show specific connection issue (DNS, timeout, etc.)
3. **Connection Quality Indicator**: Display latency (ms) when connected
4. **Fallback Strategies**: Auto-switch to backup API endpoint
5. **Connection History**: View last 24h of connection events
6. **Webhooks**: Real-time notifications of connection state changes

## Related Files

- **Main implementation**: `hooks/usePrism.ts`, `components/dashboard/ConnectionStatus.tsx`
- **Integration**: `components/dashboard/WarRoom.tsx`
- **Backend**: `pulse/api/app.py`, `api/client.ts`
- **Types**: `types/index.ts` (HealthStatus type)
- **Design**: `lib/format.ts` (T design tokens)

## References

- PRISM v4.0 Specification: `claude.md`
- Apple Design System: https://developer.apple.com/design/
- Framer Motion: https://www.framer.com/motion/
- Lucide Icons: https://lucide.dev/
