import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import AppContextProvider from "./contexts/AppContextProvider.tsx"
import App from "./App.tsx"

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<AppContextProvider>
			<App />
		</AppContextProvider>
	</StrictMode>,
)
