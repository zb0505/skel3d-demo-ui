"""
Common utils for APIs and testing
"""


# Imports
import base64
from io import BytesIO
from PIL import Image, ImageOps
from pydantic import BaseModel, ValidationError


# Utils class
class Utils:
	"""Utility functions for APIs and tests"""
	
	@staticmethod
	def image_to_base64(image: Image.Image, format: str = "jpeg") -> str:
		"""Converts a PIL image to base64. Format can be `png` or `jpeg`"""
		outimg = BytesIO()
		image.save(outimg, format=format)
		b64 = base64.b64encode(outimg.getvalue()).decode()
		outimg.close()
		return b64

	@staticmethod
	def validate_schema(json_obj: dict, Schema: type[BaseModel]):
		"""Validates the schema of the given JSON object against the provided Pydantic schema"""
		try:
			Schema(**json_obj)
			return True
		except ValidationError as e:
			return False, f"Schema validation failed: {e}"
		except Exception as e:
			return False, f"Schema validation failed: {e}"

	@staticmethod
	def load_image(path: str, mode: str = "RGB") -> str:
		"""Loads an image from the given path and converts it to base64"""
		image = Image.open(path).convert(mode)
		image = ImageOps.exif_transpose(image)
		return Utils.image_to_base64(image, format=("png" if path.endswith(".png") else "jpeg"))