# Graduation System Setup Guide

## Environment Variables Required

### 1. Create `.env` file in your project root:

```bash
# Hyperion SDK Configuration
VITE_HYPERION_API_KEY=your_aptos_build_api_key_here

# Aptos Configuration  
VITE_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com
```

### 2. Get Your Aptos Build API Key:

1. Go to [Aptos Build](https://build.aptoslabs.com/)
2. Sign up/Login
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the key and paste it in your `.env` file

### 3. Verify Setup:

After adding the API key, restart your development server:

```bash
npm run dev
```

Check the browser console for any SDK initialization errors.

## Files Created for Graduation System

### Core Files:
- `src/types/graduation.ts` - Type definitions
- `src/utils/hyperionSDK.ts` - SDK initialization
- `src/utils/graduation.ts` - Pool creation and LP locking logic
- `src/utils/graduationStorage.ts` - Retry management
- `src/hooks/useGraduation.ts` - Main graduation handler
- `src/hooks/useGraduationRetry.ts` - Automatic retry system
- `src/components/GraduationListener.tsx` - Event monitoring

### Integration:
- Added to `src/App.tsx` - GraduationListener component
- Updated `src/env.d.ts` - Environment variable types

## Next Steps

1. **Fix Transaction Format** - Resolve the signAndSubmitTransaction format issue
2. **Implement Event Listening** - Add real blockchain event monitoring
3. **Update Contract** - Add graduation event emission to the Move contract

## Testing

Once setup is complete, you can test the graduation system by:

1. Creating a token
2. Buying tokens until it reaches 1200 APT threshold
3. Monitoring console for graduation events
4. Checking if Hyperion pool is created successfully 