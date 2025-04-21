"""
Main wrapper for FastAPI apps
This file runs the given app with the given port
Usage: python main.py [app_name_or_file] [port]
"""


# Imports
import uvicorn, sys


# App init
APP = sys.argv[1].replace(".py", "") if len(sys.argv) > 1 else "demo_api"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8000


# Run the app
if __name__ == "__main__":
	print("Starting app", APP, "on port", PORT)
	uvicorn.run(f"{APP}:app", host="0.0.0.0", port=PORT, reload=False)