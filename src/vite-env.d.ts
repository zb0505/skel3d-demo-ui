/// <reference types="vite/client" />
interface ImportMetaEnv {
	// Custom variables
	readonly VITE_API_URL: string
	readonly VITE_API_KEY: string
	readonly VITE_SKEL_AI: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}