"""
SAM2 Utils
Utility functions for the SAM2 model
Initializes the SAM2 model and exports a function to generate masks for images using the model
"""


# Imports
import torch
import numpy as np
from os import path
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from dotenv import dotenv_values


# Select and configure device for torch
CONFIG = dotenv_values(".env")
if torch.cuda.is_available():
	device = torch.device(CONFIG["SAM2_GPU"])
elif torch.backends.mps.is_available():
	device = torch.device("mps")
else:
	device = torch.device("cpu")

if device.type.startswith("cuda"):
	# use bfloat16
	torch.autocast(device.type, dtype=torch.bfloat16).__enter__()
	# turn on tfloat32 for Ampere GPUs (https://pytorch.org/docs/stable/notes/cuda.html#tensorfloat-32-tf32-on-ampere-devices)
	if torch.cuda.get_device_properties(0).major >= 8:
		torch.backends.cuda.matmul.allow_tf32 = True
		torch.backends.cudnn.allow_tf32 = True


# Checkpoint and config paths
sam2_checkpoint = "./sam_checkpoints/sam2.1_hiera_tiny.pt"
model_cfg = "configs/sam2.1/sam2.1_hiera_t.yaml"


# Create SAM2 model
sam2 = build_sam2(model_cfg, sam2_checkpoint, device=device, apply_postprocessing=False)
predictor = SAM2ImagePredictor(sam2)


# Generate masks for images
def generate_masks(input_image: Image.Image, pos_points: list[tuple[int, int]] = [], neg_points: list[tuple[int, int]] = []):
	# Define input points
	pos, neg = np.array(pos_points), np.array(neg_points)
	if len(pos) == 0: pos = pos.reshape((0, 2))
	if len(neg) == 0: neg = neg.reshape((0, 2))
	input_points = np.concatenate([pos, neg], axis=0)
	input_labels = np.concatenate([np.ones(pos.shape[0]), np.zeros(neg.shape[0])], axis=0)
	print("[SAM2 Utils] Pos:", pos)
	print("[SAM2 Utils] Neg:", neg)
	
	# Convert image and generate masks
	image = np.array(input_image.convert("RGB"))
	print("[SAM2 Utils] Image shape:", image.shape)
	predictor.set_image(image)
	masks, scores, logits = predictor.predict(
		point_coords=input_points,
		point_labels=input_labels,
		multimask_output=True
	)

	# Sort by score
	sorted_ind = np.argsort(scores)[::-1]
	masks = masks[sorted_ind]
	scores = scores[sorted_ind]
	logits = logits[sorted_ind]
	print("[SAM2 Utils] Masks:", masks.shape)
	print("[SAM2 Utils] Scores:", scores.shape)
	print("[SAM2 Utils] Logits:", logits.shape)
	
	# Return None if no masks are found
	if len(masks) == 0:
		return None, None

	# Iterate over distinct masks and combine them to a single mask
	mask = np.zeros((masks.shape[1], masks.shape[2]))
	for i, m in enumerate(masks):
		mask[m == 1] = 1
		# Save masks as images when debugging
		if "/opt" not in path.realpath(__file__) and np.count_nonzero(m) > 50:
			Image.fromarray(m.astype(np.uint8).reshape(m.shape[0], m.shape[1], 1) * np.array([255, 255, 255], dtype=np.uint8), "RGB").save(f"masks/mask{i}.png")
	
	# Return masked image and mask as RGB-compatible image
	image = np.array(input_image.convert("RGBA"))
	image[mask == 0, 3] = 0
	return image, (mask.astype(np.uint8).reshape(mask.shape[0], mask.shape[1], 1) * np.array([255, 255, 255], dtype=np.uint8)).astype(np.uint8)


# Generate masks for example image when the script is run directly
if __name__ == "__main__":
	infile = "images/humanoid_figure.jpg"
	outfile = f"{infile.split('.')[0]}_cutout.png"
	print(f"Generating masks for '{infile}'")
	pos_points = [(100, 100), (200, 200)]
	neg_points = [(300, 300), (400, 400)]
	masked_img, mask = generate_masks(Image.open(f"{infile}"), pos_points, neg_points)
	masked_img = Image.fromarray(masked_img, "RGBA")
	Image.fromarray(mask, "RGB").save("mask.png")
	if not masked_img:
		print("Failed to generate masked image")
	else:
		print(f"Saving '{outfile}'")
		masked_img.save(f"{outfile}")
		print("Done")