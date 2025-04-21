"""
Skel3D Utils
Utility functions for the Skel3D model
Initializes the Skel3D model and exports a function to generate the target view using the model
"""


# Imports
import os, torch
import numpy as np

from PIL import Image
from einops import rearrange
from batch_test import tensor2image
from skel3d_init import data_provider, model, config


# Generate output image
def generate_images(
	input_image: Image.Image,
	joints: list[tuple[int, int, int]],
	bones: list[tuple[int, int]],
	src_camera: list[tuple[float, float, float, float]],
	tgt_camera: list[tuple[float, float, float, float]]
) -> list[Image.Image]:
	# Convert data to the format expected by the model
	data = data_provider.pre_data({
		"image": input_image,
		"bones": bones,
		"joints": joints,
		"src_camera": src_camera,
		"tgt_camera": tgt_camera
	})
	print("[Skel3D Utils V1] Data shapes:",
       "\n  Image:", data["images"].shape,
       "\n  Skeleton:", data["skeletons"].shape,
       "\n  World to camera:", data["w2cs"].shape,
       "\n  Camera to world:", data["c2ws"].shape,
       "\n  Intrinsics:", data["intrinsics"].shape,
       "\n  Filename:", len(data["filename"]))

	# Save input image when debugging
	if "/opt" not in os.path.realpath(__file__):
		input_image.save("tmp_input_image_skel3d.png")
		img = rearrange(tensor2image(data["images"][:, 0]), "b h w c-> b c h w")
		Image.fromarray(img[0]).save("tmp_input_transformed_skel3d.png")

	# Generate target view
	images = model.log_images(data,
		N=data["images"].size()[0], n_row=data["images"].size()[0],
		ddim_steps=50, inpaint=True, plot_progressive_rows=False, plot_diffusion_rows=False,
		unconditional_guidance_scale=3.0, unconditional_guidance_label=[""], use_ema_scope=False)
	print("[Skel3D Utils V1] Generated images:", len(images), ", type:", type(images), ", keys:", images.keys())

	# Return images
	outputs, output_keys = [], ["reconstruction", "samples_cfg_scale_3.00"]
	for k in images:
		print(f"[Skel3D Utils V1] Key: {k}, type:", type(images[k]))
		if isinstance(images[k], torch.Tensor) and k in output_keys: # Only include images with the specified keys
			print("[Skel3D Utils V1] Image shape:", images[k].size(), ", data shape:", data['images'].size())
			if images[k].size(0) == data['images'].size()[0]:
				grid = tensor2image(images[k])
			else:
				grid = tensor2image(rearrange(images[k], '(b v) ... -> b v ...', v=config.model.params.unet_config.params.views)[:,1,...])
			print("[Skel3D Utils V1] Grid shape:", grid.shape)
			for i in range(grid.shape[0]):
				outputs.append(Image.fromarray(grid[i]))
	return outputs


# Generate output when run directly
if __name__ == "__main__":
	infile = "./images/humanoid_figure_cutout.png"
	if not os.path.exists(infile): infile = "../images/humanoid_figure_cutout.png"
	print(f"Generating output for '{infile}'")
	# Source camera extrinsic (test values from API)
	src_camera_ext = [
		[-1, 0, 0, 146.00000000000028],
		[0, 1, 0, -9.130750050588659e-14],
		[0, 0, -1, -1484],
		[0, 0, 0, 1]
	]
	# Target camera (about 55deg Y-rotation relative to the source camera)
	tgt_camera_ext = [
		[0.5902813171729667, -5.204170427930423e-18, -0.807197600712829, 4.862776847858187e-14],
		[0.023586280055444483, 0.9995730058628929, 0.0172479953434492, -7.105427357601003e-15],
		[0.8068529320698375, -0.02921995808042003, 0.5900292705112898, -1491.1646455036391],
		[0, 0, 0, 1]
	]
	# Extra camera extrinsics for testing
	# Source view without rotation (front view)
	src_front = [
		[1.0, 0.0, 0.0, 0.0],
		[0.0, 1.0, 0.0, 0.0],
		[0.0, 0.0, 1.0, -4.0],
		[0.0, 0.0, 0.0, 1.0]
	]
	# Top view (above the character looking at its head)
	x_90_deg = [
		[1.0, 0.0, 0.0, 0.0],
		[0.0, 0.0, 1.0, -4.0],
		[0.0, -1.0, 0.0, 0.0],
		[0.0, 0.0, 0.0, 1.0]
	]
	# Character's left side (looking to the left side of the image)
	y_90_deg = [
		[0.0, 0.0, -1.0, 4.0],
		[0.0, 1.0, 0.0, 0.0],
		[1.0, 0.0, 0.0, 0.0],
		[0.0, 0.0, 0.0, 1.0]
	]
	# Character rotated in "2D" (looking towards the camera, character's left side upwards)
	z_90_deg = [
		[0.0, 1.0, 0.0, 0.0],
		[-1.0, 0.0, 0.0, 0.0],
		[0.0, 0.0, 1.0, -4.0],
		[0.0, 0.0, 0.0, 1.0]
	]
	outputs = generate_images(
		input_image=Image.open(f"{infile}"),
		joints=[
			[ -56.940468,  -145.63255,   2071.5398   ],
			[   2.4743893,  -45.694386,  2124.0872   ],
			[-124.60881,    -47.79473,   2068.1648   ],
			[ -62.487873,  -263.69327,   2075.2617   ],
			[  60.25595,    333.1858,    2114.662    ],
			[-192.90729,    316.40338,   2049.207    ],
			[ -49.815765,  -431.75375,   2014.5691   ],
			[   5.945604,   708.0796,    2319.1868   ],
			[-237.38284,    704.79944,   2245.317    ],
			[ -33.039135,  -459.688,     1984.3682   ],
			[  87.222275,   789.784,     2250.1045   ],
			[-236.94104,    794.598,     2143.2566   ],
			[  -5.880766,  -657.23083,   1897.4645   ],
			[  62.154297,  -592.0338,    1983.9221   ],
			[-104.72554,   -575.05725,   1909.2797   ],
			[  16.391687,  -685.63885,   1833.1605   ],
			[ 166.02696,   -587.60443,   2019.0055   ],
			[-195.96577,   -556.1678,    1859.8981   ],
			[ 179.13881,   -389.14664,   2206.6458   ],
			[-304.00153,   -343.03632,   1938.5023   ],
			[ 264.42154,   -133.1683,    2224.895    ],
			[-385.87582,   -110.29484,   1912.633    ],
			[ 290.6269,     -47.750748,  2255.1992   ],
			[-415.21533,    -27.694118,  1920.0452   ]
		],
		bones=[ [ 1,  4], [ 1,  0], [ 2,  5], [ 2,  0], [ 3,  6], [ 3,  0],
			[ 4,  7], [ 5,  8], [ 6,  9], [ 7, 10], [ 8, 11], [ 9, 12],
			[12, 13], [12, 14], [12, 15], [13, 16], [14, 17], [16, 18],
			[17, 19], [18, 20], [19, 21], [20, 22], [21, 23]
		],
		src_camera=src_camera_ext[:-1],
		tgt_camera=tgt_camera_ext[:-1]
	)
	print("Outputs:", len(outputs))
	for i, output in enumerate(outputs):
		outfile = f"{infile.split('.png')[0]}_skel3d_{i + 1}.png"
		output.save(outfile)
		print(f"Saved output image #{i + 1} to '{outfile}'")