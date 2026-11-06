/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FEATURE_GUIDE?: string;
  readonly VITE_FEATURE_SHARE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
