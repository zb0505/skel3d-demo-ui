"""
Main wrapper for FastAPI apps
This file runs the given app with the given port
Usage: python main.py [app_name_or_file] [port]
"""


# Imports
import uvicorn, sys
from dotenv import dotenv_values


# App endpoint maps
APP_ENDPOINT_MAP = {
	"demo_api": "DEMO_ENDPOINT",
	"sam2_api": "SAM2_ENDPOINT",
	"capex_api": "CAPEX_ENDPOINT",
	"skel3d_api": "SKEL3D_ENDPOINT",
	"metrabs_api": "METRABS_ENDPOINT"
}

# Gets the port for the app based on its name and endpoint
def get_port(app_name: str) -> int:
	"""Gets the port for the given app name"""
	if app_name in APP_ENDPOINT_MAP:
		try:
			return int(CONFIG[APP_ENDPOINT_MAP[app_name]].split(":")[-1])
		except (KeyError, ValueError):
			print(f"[Main] Invalid or missing port for {app_name} in config. Using default port 8000")
			return 8000
	else:
		return 8000


# App init
CONFIG = dotenv_values(".env")
APP = sys.argv[1].replace(".py", "") if len(sys.argv) > 1 else "demo_api"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else get_port(APP) # CLI args always take precedence


# Run the app
if __name__ == "__main__":
	print("Starting app", APP, "on port", PORT)
	uvicorn.run(f"{APP}:app", host="0.0.0.0", port=PORT, reload=False)