"""
MeTRAbs Utils
Utility functions for the MeTRAbs model
Initializes the MeTRAbs model and exports a function to generate 3D skeletons for images using the model
"""


# Imports
import numpy as np
import tensorflow as tf
import tensorflow_hub as tfhub
from PIL import Image, ImageOps
from os import path


# Load and init model
metrabs_model = tfhub.load("https://bit.ly/metrabs_s")


# Generate 3D points
def generate_skeleton(input_image: Image.Image, bbox: tuple[int, int, int, int] | None = None) -> tuple[np.ndarray[np.int64, np.int64], np.ndarray[np.int64, np.int64], dict]:
	# Convert image to tensor
	input_tensor = tf.convert_to_tensor(np.array(input_image.convert("RGB")))
	print("[MeTRAbs Utils] Input tensor shape:", input_tensor.shape)

	# Save image when debugging
	if "/opt" not in path.realpath(__file__):
		Image.fromarray(input_tensor.__array__(), "RGB").save("metrabs_input_image.jpg")
	
	# Detect poses on the picture
	if bbox is None: output = metrabs_model.detect_poses(input_tensor, skeleton='smpl_24')
	else: output = metrabs_model.estimate_poses(input_tensor, tf.convert_to_tensor([bbox], dtype=tf.float32), skeleton='smpl_24')
	
	# Get 3D joint points and bones
	poses = output["poses3d"].numpy().astype(np.int64)
	bones = metrabs_model.per_skeleton_joint_edges["smpl_24"].numpy() if poses.shape[0] > 0 else np.array([])

	# If no poses are detected, return empty arrays
	if poses.shape[0] == 0: return np.array([]), np.array([]), output

	# Mirror and centralize the skeleton so the UI can use it without additional transformations (if any)
	minX, minY, minZ = poses[:, :, 0].min(), poses[:, :, 1].min(), poses[:, :, 2].min()
	maxX, maxY, maxZ = poses[:, :, 0].max(), poses[:, :, 1].max(), poses[:, :, 2].max()
	trX, trY, trZ = (maxX - minX) // 2, (maxY - minY) // 2, (maxZ - minZ) // 2
	poses[:, :, 0] = poses[:, :, 0] * -1 # Mirror on X axis
	poses[:, :, 1] = poses[:, :, 1] * -1 # Mirror on Y axis
	poses[:, :, 0] = poses[:, :, 0] - trX - minX
	poses[:, :, 1] = poses[:, :, 1] + trY + minY
	poses[:, :, 2] = poses[:, :, 2] - trZ - minZ

	# Return outputs
	return poses, bones, output


# Generate skeleton points for example image when run directly
if __name__ == "__main__":
	infile = "./images/humanoid_figure.jpg"
	outfile = f"{infile.split('.jpg')[0]}_skel.png"
	print(f"Generating masks for '{infile}'")
	image = ImageOps.exif_transpose(Image.open(f"{infile}"))
	output, bones, orig_output = generate_skeleton(image)
	print("Output:", output)
	print("Bones:", bones)
	print("Model output:", orig_output)