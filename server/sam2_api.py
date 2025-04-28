"""
SAM2 API
Runs the SAM2 segmentation model on the input image with the given positive and negative points
and generates the segmentation mask and preview image
"""


# Imports
import base64
import numpy as np
from os import path
from io import BytesIO
from fastapi import FastAPI
from PIL import Image, ImageEnhance, ImageOps
from sam2_utils import generate_masks
from demo_models import SAM2Input, SAM2Output
from common_utils import Utils


# SAM2 controller
class SAM2API:
	"""SAM2 controller class for the API endpoints"""
	def __init__(self):
		"""Initializes the controller for the SAM2 API"""
		self.app = FastAPI(
			title="SAM2 API",
			description="API for SAM2 segmentation model"
		)

		# Add the route to the router
		self.app.add_api_route("/predict", self.predict, methods=["POST"], response_model=SAM2Output)
	
	# POST /predict
	async def predict(self, data: SAM2Input):
		"""Performs segmentation on the given data"""
		# Convert image from base64
		img = Image.open(BytesIO(base64.b64decode(data.image.split(",")[-1])))
		img = ImageOps.exif_transpose(img) # Rotate image according to EXIF data

		# Run SAM2 segmentation
		print("[SAM2 API] Positive points:", data.points.positive)
		print("[SAM2 API] Negative points:", data.points.negative)
		output, _ = generate_masks(img, data.points.positive, data.points.negative)
		if output is None: return { "segmentation": "", "preview": "", "bbox": [] }
		segmentation = Image.fromarray(output, "RGBA")

		# Save segmentation image when debugging
		if "/opt" not in path.realpath(__file__): segmentation.save("tmp_segmentation.png")

		# Make original image grayscale and paste segmentation on it
		grayscale = np.array(ImageEnhance.Color(img.convert("RGBA")).enhance(0))
		print("First couple pixels:", grayscale[:5, 0])
		grayscale[:, :, 3] //= 2 # Make grayscale background semi-transparent for better view on UI
		grayscale = Image.fromarray(grayscale, "RGBA")
		preview = Image.alpha_composite(grayscale, segmentation)

		# Return images as base64
		prevb64 = Utils.image_to_base64(preview, "png")
		segmb64 = Utils.image_to_base64(segmentation, "png")

		# Detect bounding boxes based on the segmentation mask (useful for MeTRAbs)
		vbounds = np.where(np.any(output[:, :, 3] > 0, axis=1))[0][[0, -1]]
		hbounds = np.where(np.any(output[:, :, 3] > 0, axis=0))[0][[0, -1]]
		
		return {
			"segmentation": f"data:image/png;base64,{segmb64}",
			"preview": f"data:image/png;base64,{prevb64}",
			"bbox": [
				hbounds[0], # Left
				vbounds[0], # Top
				hbounds[1] - hbounds[0], # Width
				vbounds[1] - vbounds[0] # Height
			]
		} if len(vbounds) > 0 and len(hbounds) > 0 else {
			"segmentation": f"data:image/png;base64,{segmb64}",
			"preview": f"data:image/png;base64,{prevb64}",
			"bbox": []
		}


# Create app instance and export it for testing
sam2_api = SAM2API()
app = sam2_api.app