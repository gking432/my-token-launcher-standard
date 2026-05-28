/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APTOS_API_KEY: string
  readonly VITE_HYPERION_API_KEY: string
  readonly VITE_FEATURE_BOOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 