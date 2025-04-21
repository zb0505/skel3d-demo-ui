"""
CapeX API
Runs the CapeX model on the input image and generates skeleton joints' coordinates in 2D
which are then transformed to 3D with a static Z coordinate
"""


# Imports
import base64
import numpy as np
from io import BytesIO
from fastapi import FastAPI
from PIL import Image, ImageOps
from demo_models import CapeXInput, CapeXOutput

# During development, CapeX utils are inside the capex directory
try:
	from capex_utils import generate_skeleton
except (ImportError, ModuleNotFoundError):
	from capex.capex_utils import generate_skeleton


# CapeX controller
class CapeXAPI:
	"""CapeX controller class for the API endpoints"""
	def __init__(self):
		"""Initializes the controller for the CapeX API"""
		self.app = FastAPI(
			title="CapeX API",
			description="API for CapeX skeleton generation model"
		)

		# Add the route to the router
		self.app.add_api_route("/predict", self.predict, methods=["POST"], response_model=CapeXOutput)
	
	# POST /predict
	async def predict(self, data: CapeXInput):
		"""Performs skeleton generation on the given data"""
		# Convert images from base64
		img = Image.open(BytesIO(base64.b64decode(data.image.split(",")[-1])))
		img = ImageOps.exif_transpose(img) # Rotate image according to EXIF data

		# Run Skel3D prediction
		points, output, _ = generate_skeleton(img, data.keypoints, data.skeleton)
		minmax = np.vstack((points.min(axis=0), points.max(axis=0)), dtype=np.int64).T

		# Return keypoints
		return { "skeleton": points, "minmax": minmax, "original": output }


# Create app instance and export it for testing
capex_api = CapeXAPI()
app = capex_api.app