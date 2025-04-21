"""
Skel3D API
Runs the Skel3D model on the input image and generates the view that would be seen
if the object was rotated to the target position from the input position
"""


# Imports
import base64
from io import BytesIO
from fastapi import FastAPI
from PIL import Image, ImageOps
from demo_models import Skel3DInput, Skel3DOutput
from common_utils import Utils

# During development, Skel3D utils are inside the free3d directory
try:
	from skel3d_utils import generate_images
	from skel3d_utils_v2 import generate_images as generate_images_v2
except (ImportError, ModuleNotFoundError):
	from free3d.skel3d_utils import generate_images
	from free3d.skel3d_utils_v2 import generate_images as generate_images_v2


# Skel3D controller
class Skel3DAPI:
	"""Skel3D controller class for the API endpoints"""
	def __init__(self):
		"""Initializes the controller for the Skel3D API"""
		self.app = FastAPI(
			title="Skel3D API",
			description="API for Skel3D image generation model"
		)

		# Add the route to the router
		self.app.add_api_route("/predict", self.predict, methods=["POST"], response_model=Skel3DOutput)

	# POST /predict
	async def predict(self, data: Skel3DInput):
		"""Performs Skel3D prediction on the given data"""
		# Convert image from base64 to PIL image and apply EXIF rotation
		img = Image.open(BytesIO(base64.b64decode(data.image.split(",")[-1])))
		img = ImageOps.exif_transpose(img)  # Rotate image according to EXIF data
		img_bytes = BytesIO() # Format required for v2 utils (processes image internally which uses Image.open)
		img.save(img_bytes, format="png")

		# Run Skel3D predictions
		outputs = generate_images(
			input_image=img,
			joints=data.joints,
			bones=data.bones,
			src_camera=data.src_camera[:-1],
			tgt_camera=data.target_camera[:-1]
		) # Expects 3x4 extrinsics
		outputs_v2 = generate_images_v2(
			input_image=img_bytes,
			joints=data.joints,
			bones=data.bones,
			src_camera_ext=data.src_camera,
			tgt_camera_ext=data.target_camera
		) # Expects 4x4 extrinsics

		# Return images as base64
		imgs = []
		for img in outputs + outputs_v2:
			outb64 = Utils.image_to_base64(img, "png")
			imgs.append(f"data:image/png;base64,{outb64}")
		return { "predictions": imgs }


# Create app instance and export it for testing
skel3d_api = Skel3DAPI()
app = skel3d_api.app