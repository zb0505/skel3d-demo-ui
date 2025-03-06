/// <reference types="vite/client" />
interface ImportMetaEnv {
	// Custom variables
	readonly VITE_API_URL: string
	readonly VITE_API_KEY: string
	readonly VITE_ENC_KEY: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}