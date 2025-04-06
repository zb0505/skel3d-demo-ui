/// <reference types="vite/client" />
interface ImportMetaEnv {
	// Environment variables
	readonly VITE_DEBUG: string
	readonly VITE_API_URL: string
	readonly VITE_API_KEY: string
	readonly VITE_SKEL_AI: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}