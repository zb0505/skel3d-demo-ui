"""
Demo API main router (for clustered API endpoints)
The endpoints call the respective APIs and return the results
"""

# Imports
import requests
from typing import Annotated
from dotenv import dotenv_values
from fastapi import FastAPI, Header, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from requests.exceptions import RequestException
from demo_models import *


# Base controller class
class BaseController:
	"""Base controller class for the API endpoints"""
	def __init__(self, tags: list[str] = None):
		"""Initializes the controller with the given endpoint (endpoint name is the key in the .env file)"""
		self._config = dotenv_values(".env")
		"""Configuration values from .env file"""
		self.version = self._config["VERSION"]
		"""API version"""
		self._api_key = self._config["API_KEY"]
		"""API key for authorization"""
		self.router = APIRouter(tags=tags)
		"""APIRouter instance for the controller"""

	def verify_auth(self, authorization: str | None):
		"""Verifies the authorization header"""
		if not authorization or authorization != self._api_key:
			print("Authorization failed:", authorization)
			raise HTTPException(status_code=401, detail="Unauthorized")

	def query(self, endpoint: str, data: BaseModel):
		"""Queries the API with the given data"""
		try:
			resp = requests.post(f"http://{endpoint}/predict", json=data.model_dump(), timeout=30)
			return resp.json() if resp.ok else None
		except RequestException:
			return None


# Segmentation controller
class SegmentationController(BaseController):
	"""Segmentation controller class for the SAM2 API"""
	def __init__(self):
		super().__init__(tags=["Segmentation"])
		# Add the route to the router
		self.router.add_api_route("/segmentate", self.segmentate, methods=["POST"], response_model=SAM2Output)

	# POST /segmentate
	async def segmentate(self, data: SAM2Input, authorization: Annotated[str | None, Header()] = None):
		"""Performs segmentation on the given data"""
		# Authorize the user with API key
		self.verify_auth(authorization)
		# Query SAM2 API and return result
		resp = self.query(self._config["SAM2_ENDPOINT"], data)
		return resp if resp else { "segmentation": None, "preview": None, "bbox": None }


# Skeleton controller
class SkeletonController(BaseController):
	"""Skeleton controller class for skeleton generation APIs"""
	def __init__(self):
		super().__init__(tags=["Skeleton"])
		# Add the route to the router
		self.router.add_api_route("/skeleton", self.skeleton, methods=["POST"], response_model=MeTRAbsOutput)
		self.router.add_api_route("/skeleton_capex", self.capex_skeleton, methods=["POST"], response_model=CapeXOutput)
	
	# POST /skeleton
	async def skeleton(self, data: MeTRAbsInput, authorization: Annotated[str | None, Header()] = None):
		"""Generates skeleton based on the given input data via MeTRAbs"""
		# Authorize the user with API key
		self.verify_auth(authorization)
		# Query MeTRAbs API and return result
		resp = self.query(self._config["METRABS_ENDPOINT"], data)
		return resp if resp else { "skeleton": None, "original": None, "bones": None, "minmax": None }

	# POST /skeleton_capex
	async def capex_skeleton(self, data: CapeXInput, authorization: Annotated[str | None, Header()] = None):
		"""Generates skeleton based on the given input data via CapeX"""
		# Authorize the user with API key
		self.verify_auth(authorization)
		# Query CapeX API and return result
		resp = self.query(self._config["CAPEX_ENDPOINT"], data)
		return resp if resp else { "skeleton": None, "original": None, "minmax": None }


# Skel3D controller
class Skel3DController(BaseController):
	"""Skel3D controller class for the Skel3D API"""
	def __init__(self):
		super().__init__(tags=["Skel3D"])
		# Add the route to the router
		self.router.add_api_route("/skel3d", self.skel3d_prediction, methods=["POST"], response_model=Skel3DOutput)

	# POST /skel3d
	async def skel3d_prediction(self, data: Skel3DInput, authorization: Annotated[str | None, Header()] = None):
		"""Performs Skel3D prediction on the given data"""
		# Authorize the user with API key
		self.verify_auth(authorization)
		# Query Skel3D API and return result
		resp = self.query(self._config["SKEL3D_ENDPOINT"], data)
		return resp if resp else { "predictions": None }


# Demo API controller
class DemoAPI:
	"""Demo API controller class for the main API"""
	def __init__(self):
		# Initialize the API with the given endpoints
		self.config = dotenv_values(".env")
		self.app = FastAPI(
			title="Demo API",
			description="Demo API for segmentation and skeleton generation",
			version=self.config["VERSION"],
		)

		# Allowed origins
		self.origins = [
			"http://localhost:5173",
			"http://localhost:8000"
		]

		# Configure CORS middleware
		self.configure_cors()

		# Init controllers
		self.controllers: list[BaseController] = [
			SegmentationController(),
			SkeletonController(),
			Skel3DController(),
		]

		# Configure routes
		self.configure_routes()

	def configure_cors(self):
		"""Configures CORS middleware for the API"""
		self.app.add_middleware(
			CORSMiddleware,
			allow_origins=self.origins,
			allow_credentials=True,
			allow_methods=["*"],
			allow_headers=["*"],
		)

	def configure_routes(self):
		"""Configures the routes for the API"""
		for controller in self.controllers:
			# Include the router for each controller
			self.app.include_router(controller.router)

		# Add index route
		self.app.add_api_route("/", self.index, methods=["GET"], tags=["Status"])

	# GET /
	async def index(self):
		"""Index route for the API"""
		return { "version": self.config["VERSION"] }


# Create app instance and export it for testing
demo_api = DemoAPI()
app = demo_api.app
API_KEY = demo_api.config["API_KEY"]