"""
Collection of Pydantic JSON models for the API endpoints
"""


# Imports
from typing import Optional
from pydantic import BaseModel


# JSON objects for SAM2
class SupportPoints(BaseModel):
	"""Support points schema definition for the SAM2 API"""
	positive: list[tuple[int, int]]
	"""Positive points for segmentation"""
	negative: list[tuple[int, int]]
	"""Negative points for segmentation"""

class SAM2Input(BaseModel):
	"""Input data schema for the SAM2 API"""
	image: str
	"""The whole image file as base64"""
	points: SupportPoints
	"""Positive and negative points for segmentation"""

class SAM2Output(BaseModel):
	"""Output data schema for the SAM2 API"""
	segmentation: Optional[str]
	"""The segmentation image with transparent background in base64"""
	preview: Optional[str]
	"""The preview image with grayscale background in base64"""
	bbox: Optional[tuple[int, int, int, int]]
	"""The bounding box of the detected object (order: left, top, width, height)"""


# JSON objects for CapeX
class CapeXInput(BaseModel):
	"""Input data schema for the CapeX API"""
	image: str
	"""The whole image file as base64"""
	keypoints: list[str]
	"""The image keypoint labels"""
	skeleton: list[tuple[int, int]]
	"""The keypoint pairs as support skeleton (bones)"""

class CapeXOutput(BaseModel):
	"""Output data schema for the CapeX API"""
	skeleton: Optional[list[tuple[int, int, int]]]
	"""The detected keypoints in 3D"""
	original: Optional[list[tuple[int, int]]]
	"""The originally detected keypoints in 2D without transformations"""
	minmax: Optional[list[tuple[int, int]]]
	"""The minimum and maximum value of coords along each axis"""


# JSON objects for MeTRAbs
class MeTRAbsInput(BaseModel):
	"""Input data schema for the MeTRAbs API"""
	image: str
	"""The whole image file as base64"""
	bbox: Optional[tuple[int, int, int, int]]
	"""The bounding box coordinates of the object (order: left, top, width, height)"""

class MeTRAbsOutput(BaseModel):
	"""Output data schema for the MeTRAbs API"""
	skeleton: Optional[list[tuple[int, int, int]]]
	"""The detected keypoints in 3D"""
	original: Optional[list[tuple[int, int, int]]]
	"""The originally detected keypoints in 3D without transformations"""
	minmax: Optional[list[tuple[int, int]]]
	"""The minimum and maximum value of coords along each axis"""
	bones: Optional[list[tuple[int, int]]]
	"""The bones used for the skeleton"""


# JSON objects for Skel3D
class Skel3DInput(BaseModel):
	"""Input data schema for the Skel3D API"""
	image: str
	"""The segmentated input image as base64"""
	joints: list[tuple[int, int, int]]
	"""The skeleton's joint coordinates"""
	bones: list[tuple[int, int]]
	"""The skeleton's bone pairs"""
	src_camera: list[tuple[float, float, float, float]]
	"""The source view camera extrinsic matrix (square, 4x4)"""
	target_camera: list[tuple[float, float, float, float]]
	"""The target view camera extrinsic matrix (square, 4x4)"""
	rotation: tuple[float, float, float]
	"""The rotation described in Euler angles (XYZ in radians, OpenCV convention)"""

class Skel3DOutput(BaseModel):
	"""Output data schema for the Skel3D API"""
	predictions: Optional[list[str]]
	"""The generated images as base64"""