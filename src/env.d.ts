/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APTOS_API_KEY: string
  readonly VITE_HYPERION_API_KEY: string
  // Add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 