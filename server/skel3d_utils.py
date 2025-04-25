"""
Skel3D Utils
Utility functions for the Skel3D model
Initializes the Skel3D model and exports a function to generate the target view using the model
"""


# Imports
import os, torch, math
from PIL import Image
from einops import rearrange
from batch_test import tensor2image
from skel3d_init import data_provider, models
from skel3d_utils_v2 import calculate_rotation_from_camera
from models.ddim import DDIMSampler
from contextlib import nullcontext


# Generate output image
def generate_images(
	input_image: Image.Image,
	joints: list[tuple[int, int, int]],
	bones: list[tuple[int, int]],
	src_camera: list[tuple[float, float, float, float]],
	tgt_camera: list[tuple[float, float, float, float]]
) -> list[Image.Image]:
	# Define constants
	model = models["free3d"]
	n_samples, scale = 1, 3.0
	ddim_steps, ddim_eta = 50, 1.0
	h, w = 256, 256

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
	
	# Transform skeleton for conditioning and get unconditional conditioning
	zi, c_cond, xi, xrec, xc , xs, skels = model.get_input(
		data, models["free3d"].first_stage_key,
		return_first_stage_outputs=True,
		force_c_encode=True,
		return_original_cond=True,
		bs=data["images"].size()[0],
		train=False
	)

	# Generate target view
	sampler = DDIMSampler(models['free3d'])
	precision_scope = nullcontext
	images = []
	with precision_scope('cuda'):
		with models['free3d'].ema_scope():
			# Get conditional input
			cond = c_cond

			# Get unconditional conditioning
			if scale != 1.0:
				uc = model.get_unconditional_conditioning(xi.shape[0], [""], image_size=xi.shape[-1])
			else:
				uc = None

			samples_ddim, _ = sampler.sample(
				S=ddim_steps,
				batch_size=1,
				shape=[4, h // 8, w // 8],
				conditioning=cond,
				eta=ddim_eta,
				temperature=0.3,
				unconditional_guidance_scale=scale,
				unconditional_conditioning=uc,
				repeat_noise=True,
			)
			x_samples = models['free3d'].decode_first_stage(samples_ddim)
			print("[Skel3D Utils V1] Samples DDIM shape:", samples_ddim.shape, ", samples shape:", x_samples.shape)

			grid = tensor2image(x_samples)
			grid = rearrange(grid, '(b v) ... -> b v ...', b=n_samples)
			for i in range(grid.shape[0]):
				for j in range(grid.shape[1]):
					images.append(Image.fromarray(grid[i][j]))
					# Save each image step when debugging
					if "/opt" not in os.path.realpath(__file__):
						outfile = f"tmp_output_skel3d_{i}_{j}.png"
						images[-1].save(outfile)
						print(f"Saved output image '{outfile}'")
						
	# Return generated images
	return images


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