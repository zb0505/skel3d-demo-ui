"""
MeTRAbs API
Runs the MeTRAbs model on the input image and generates skeleton joints' coordinates in 3D
"""


# Imports
import base64
import numpy as np
from io import BytesIO
from fastapi import FastAPI
from PIL import Image, ImageOps
from demo_models import MeTRAbsInput, MeTRAbsOutput
from metrabs_utils import generate_skeleton


# MeTRAbs controller
class MeTRAbsAPI:
	"""MeTRAbs controller class for the API endpoints"""
	def __init__(self):
		"""Initializes the controller for the MeTRAbs API"""
		self.app = FastAPI(
			title="MeTRAbs API",
			description="API for MeTRAbs skeleton generation model"
		)

		# Add the route to the router
		self.app.add_api_route("/predict", self.predict, methods=["POST"], response_model=MeTRAbsOutput)

	# POST /predict
	async def predict(self, data: MeTRAbsInput):
		"""Performs skeleton generation on the given data"""
		# Convert images from base64
		img = Image.open(BytesIO(base64.b64decode(data.image.split(",")[-1])))
		img = ImageOps.exif_transpose(img) # Rotate image according to EXIF data

		# Run Skel3D prediction
		points, bones, output = generate_skeleton(img, data.bbox)
		orig_points = output["poses3d"].numpy().astype(np.int64)
		print("[MeTRAbs API] Points shape:", points.shape)
		if points.shape[0] == 0: return { "skeleton": [], "original": [], "minmax": [], "bones": [] }
		else: points, orig_points = points[0], orig_points[0]
		minmax = np.vstack((points.min(axis=0), points.max(axis=0)), dtype=np.int64).T

		# Return keypoints
		return { "skeleton": points, "original": orig_points, "minmax": minmax, "bones": bones }


# Create app instance and export it for testing
metrabs_api = MeTRAbsAPI()
app = metrabs_api.app