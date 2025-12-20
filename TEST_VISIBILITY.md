# Testing Page Visibility and API Polling

## How to Test

### Step 1: Open Browser Console
1. Open your app in the browser
2. Open Developer Tools (F12 or Cmd+Option+I on Mac)
3. Go to the Console tab

### Step 2: Watch for Log Messages
You should see messages like:
- `▶️ HomePage: Starting token polling (tab visible)`
- `▶️ AptPriceContext: Starting APT price polling (tab visible)`
- `▶️ GraduationListener: Starting (tab visible)`

### Step 3: Hide the Tab
1. Switch to a different browser tab OR minimize the browser window
2. Watch the console - you should see:
   - `👁️ Page visibility changed: HIDDEN`
   - `⏸️ HomePage: Polling paused (tab hidden)`
   - `⏸️ AptPriceContext: Polling paused (tab hidden)`
   - `⏸️ GraduationListener: Paused (tab hidden)`

### Step 4: Show the Tab Again
1. Switch back to your app tab
2. Watch the console - you should see:
   - `👁️ Page visibility changed: VISIBLE`
   - `▶️ HomePage: Starting token polling (tab visible)`
   - `▶️ AptPriceContext: Starting APT price polling (tab visible)`
   - `▶️ GraduationListener: Starting (tab visible)`

### Step 5: Verify API Calls Stop
1. With the tab hidden, wait 1-2 minutes
2. Check your API dashboard - you should see NO new requests during this time
3. Switch back to the tab - you should see new requests resume

## What the Dashboard Should Show

**Before the fix:**
- Continuous small spikes every 60 seconds (token polling)
- Continuous small spikes every 30 seconds (graduation listener)
- Activity even when tab is hidden

**After the fix (when tab is hidden):**
- NO new API requests
- Flat line on the request count graph
- Active concurrent streams may drop to 0

**After the fix (when tab is visible):**
- Normal polling resumes
- Requests every 30-60 seconds as expected

## Troubleshooting

If you still see API calls when the tab is hidden:

1. **Check if the app is open in multiple tabs** - Close all tabs and reopen just one
2. **Check if the changes are deployed** - Make sure you've rebuilt and refreshed the app
3. **Check the console logs** - Look for the visibility messages to confirm the hook is working
4. **Check for other sources** - Some API calls might come from other services (not Geomi)

## Quick Test Script

You can also test in the browser console directly:

```javascript
// Check current visibility
console.log('Is visible?', !document.hidden);

// Listen for changes
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed:', !document.hidden ? 'VISIBLE' : 'HIDDEN');
});
```

