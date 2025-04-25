"""
Skel3D Utils V2 (experimental)
Utility functions for the Skel3D model
Initializes the Skel3D model and exports a function to generate the target view using the model
"""


# Imports
import torch
import os, io, math
import numpy as np
from PIL import Image
from einops import rearrange
from torchvision import transforms
from batch_test import tensor2image
from test import preprocess_image, get_sample_ray
from models.ddim import DDIMSampler
from contextlib import nullcontext
from skel3d_init import models, data_provider, device_skel3d as device
from kornia.geometry.conversions import rotation_matrix_to_quaternion, euler_from_quaternion


# Transform source and target extrinsics
def transform_extrinsics(extrinsics: np.ndarray | list[np.ndarray]) -> np.ndarray:
	"""
	Transforms extrinsic matrices so that source matrix will be identity and target matrix will be relative to that
	with the original rotation applied. Also applies OpenGL to OpenCV conversion.
	Args:
		extrinsics: extrinsic matrices in 4x4 format
	Returns: transformed extrinsic matrices in 4x4 format
	"""
	# Extract source and target camera
	src_cam, tgt_cam = np.array(extrinsics[0]), np.array(extrinsics[1])

	# Calculate source inverse and target relative to source with original rotation
	src_cam_inv = np.linalg.inv(src_cam)
	src_cam = np.dot(src_cam_inv, src_cam)
	tgt_cam = np.dot(src_cam_inv, tgt_cam)

	# Set translation vectors to static vectors
	src_cam[:, 3] = np.array([0, 0, 4, 1])
	tgt_cam[:, 3] = np.array([0, 0, 4, 1])

	# Apply OpenGL to OpenCV conversion
	w2cs_gl = torch.tensor(np.array([src_cam, tgt_cam]), dtype=torch.float32)
	opengl_to_colmap = torch.tensor([
		[  1,  0,  0,  0],
		[  0, -1,  0,  0],
		[  0,  0, -1,  0],
		[  0,  0,  0,  1]
	], dtype=torch.float32)
	w2cs = torch.einsum("nj, bjm-> bnm", opengl_to_colmap, w2cs_gl)

	# Return extrinsics as 4x4 matrices
	return w2cs.numpy()


# Calculate rotation from camera extrinsics
def calculate_rotation_from_camera(
	src_camera_ext: list[tuple[float, float, float, float]] | np.ndarray | torch.Tensor,
	tgt_camera_ext: list[tuple[float, float, float, float]] | np.ndarray | torch.Tensor
) -> tuple[torch.Tensor, tuple[float, float, float]]:
	"""
	Calculates rotation parameters from camera extrinsics. Uses W2C extrinsics as input.
	Returns the rotation matrix and Euler angles in radians
	"""
	
	# Convert inputs to numpy
	src_cam_np = src_camera_ext.numpy() if hasattr(src_camera_ext, 'numpy') else np.array(src_camera_ext)
	tgt_cam_np = tgt_camera_ext.numpy() if hasattr(tgt_camera_ext, 'numpy') else np.array(tgt_camera_ext)

	# Apply transformations (source to identity, target relative to that and OpenGL to OpenCV)
	w2cs = transform_extrinsics([src_cam_np, tgt_cam_np])
	src_cam_np, tgt_cam_np = w2cs[0], w2cs[1]

	# Convert to C2W for correct Euler extraction
	src_cam_np = np.linalg.inv(src_cam_np)
	tgt_cam_np = np.linalg.inv(tgt_cam_np)
	
	# Calculate source camera to target camera rotation
	# Extract rotation matrices
	src_rot = src_cam_np[:3, :3]
	tgt_rot = tgt_cam_np[:3, :3]
	
	# Calculate relative rotation (target relative to source)
	rel_rot = np.dot(tgt_rot, np.linalg.inv(src_rot))

	# Convert rotation matrix to Euler angles
	# This assumes rotation order is Z-Y-X (most common in computer graphics)
	sy = np.sqrt(rel_rot[0, 0] * rel_rot[0, 0] + rel_rot[1, 0] * rel_rot[1, 0])
	
	print("[Skel3D Utils V2] Rotation matrix singular:", sy <= 1e-6, " sy:", sy)
	rot_tensor = torch.tensor(rel_rot)
	qw, qx, qy, qz = rotation_matrix_to_quaternion(rot_tensor)
	x, y, z = euler_from_quaternion(qw, qx, qy, qz)
	x, y, z = x.item(), y.item(), z.item()
	
	# Create the tensor format required by the model
	T = torch.tensor([
		[0, math.sin(0), math.cos(0), 0],
		[x, math.sin(y), math.cos(y), z]
	])
	
	# Return the rotation matrix and Euler angles
	return T, (x, y, z)


# Generate output image
def generate_images(
	input_image: str | io.BytesIO,
	joints: list[tuple[int, int, int]],
	bones: list[tuple[int, int]],
	src_camera_ext: list[tuple[float, float, float, float]],
	tgt_camera_ext: list[tuple[float, float, float, float]],
	rotation: tuple[float, float, float] = None,
	src_camera_int: list[tuple[float, float, float]] = None,
	tgt_camera_int: list[tuple[float, float, float]] = None
) -> list[Image.Image]:
	# Convert data to suitable format
	img = preprocess_image(models, input_image)
	N_views, n_samples, scale = 1, 1, 3.0
	ddim_steps, ddim_eta = 50, 1.0
	h, w = 256, 256
	extrinsics = torch.tensor(transform_extrinsics([src_camera_ext, tgt_camera_ext]))
	src_camera_ext, tgt_camera_ext = torch.tensor(src_camera_ext), torch.tensor(tgt_camera_ext)
	if src_camera_int is not None and tgt_camera_int is not None:
		src_camera_int, tgt_camera_int = torch.tensor(src_camera_int), torch.tensor(tgt_camera_int)
		intrinsics = torch.cat((torch.tensor(src_camera_int), torch.tensor(tgt_camera_int)), dim=0).reshape((2, *src_camera_int.shape)).to(device)
	else: intrinsics = None
	print("[Skel3D Utils V2] Extrinsics shape:", extrinsics.shape, ", intrinsics shape:", intrinsics.shape if intrinsics else None)
	
	# If no rotation is provided, calculate it from the camera W2C extrinsics (not always stable)
	if rotation is None:
		T, (x, y, z) = calculate_rotation_from_camera(src_camera_ext, tgt_camera_ext)
	# Use API-provided rotation angles instead of calculating them from W2C extrinsics if provided
	else:
		x, y, z = rotation
		T = torch.tensor([
			[0, math.sin(0), math.cos(0), 0],
			[x, math.sin(y), math.cos(y), z]
		])
	plucker_ray = get_sample_ray(extrinsics, intrinsics)
	print("[Skel3D Utils V2] Rotation angles:",
		"\n    X:", math.degrees(x),
		"\n    Y:", math.degrees(y),
		"\n    Z:", math.degrees(z)
	)

	# Get skeleton via DataProvider
	model = models["free3d"]
	data = data_provider.pre_data({
		"image": Image.open(input_image),
		"bones": bones,
		"joints": joints,
		"src_camera": src_camera_ext[:-1].tolist(),
		"tgt_camera": tgt_camera_ext[:-1].tolist()
	})

	# Transform skeleton for conditioning and get unconditional conditioning
	zi, c_cond, xi, xrec, xc , xs, skels = model.get_input(
		data, models["free3d"].first_stage_key,
		return_first_stage_outputs=True,
		force_c_encode=True,
		return_original_cond=True,
		bs=data["images"].size()[0],
		train=False
	)
	print("[Skel3D Utils V2] Data:",
		"\n  zi:", zi.shape,
		"\n  c_cond:", { k: f"({len(c_cond[k])}) {c_cond[k][0].shape}" if type(c_cond[k]) == list else c_cond[k].shape for k in c_cond.keys() },
		"\n  xi:", xi.shape,
		"\n  xrec:", xrec.shape,
		"\n  xc:", xc.shape,
		"\n  xs:", xs.shape,
		"\n  skels:", skels.shape
    )

	# Get input image
	src_img = transforms.ToTensor()(img).unsqueeze(0).to(device)
	src_img = src_img * 2 - 1
	src_img = transforms.functional.resize(src_img, [h, w])
	
	sampler = DDIMSampler(models['free3d'])
	precision_scope = nullcontext
	images = []
	with precision_scope('cuda'):
		with models['free3d'].ema_scope():
			# Get conditional input
			src_concat = models['free3d'].encode_first_stage(src_img).mode().detach().unsqueeze(1).repeat(n_samples, N_views, 1, 1, 1)
			src_concat = rearrange(src_concat, 'b v c h w -> (b v) c h w')

			# Get cross attention condition
			src_cross = models['free3d'].get_learned_conditioning(src_img).unsqueeze(1).repeat(n_samples, N_views, 1, 1)
			T = T[1, :].to(src_cross.device).repeat(n_samples, 1, 1).unsqueeze(2)
			print("[Skel3D Utils V2] src_cross shape:", src_cross.shape)
			print("[Skel3D Utils V2] T shape:", T.shape)
			src_cross = rearrange(torch.cat([src_cross, T], dim=-1), 'b v l c -> (b v) l c')
			src_cross = models['free3d'].cc_projection(src_cross)

			# Get ray conditioning 
			pose_emb = models['free3d'].ray_embedding(plucker_ray.to(device)).unsqueeze(1).repeat(n_samples, 1, 1, 1)
			pose_emb = rearrange(pose_emb, 'b v (h w) c-> (b v) c h w', h=32, w=32)
			print("[Skel3D Utils V2] Conditioning shapes:",
				"\n  src_concat:", src_concat.shape, "vs c_cond['c_concat']:", c_cond['c_concat'][0].shape,
				"\n  src_cross:", src_cross.shape, "vs c_cond['c_crossattn']:", c_cond['c_crossattn'][0].shape,
				"\n  pose_emb:", pose_emb.shape, "vs c_cond['c_pose']:", c_cond['c_pose'].shape,
				"\n  plucker_ray:", plucker_ray.shape, "  c_cond['c_skel']:", c_cond['c_skel'].shape
			)

			# Override conditioning values
			cond = c_cond
			cond['c_crossattn'] = [src_cross]
			cond["c_concat"] = [src_concat]

			# Prepare unconditional conditioning
			if scale != 1.0:
				uc = model.get_unconditional_conditioning(xi.shape[0], [""], image_size=xi.shape[-1])
			else:
				uc = None

			# Generate target view
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
			print("[Skel3D Utils V2] Samples DDIM shape:", samples_ddim.shape, ", samples shape:", x_samples.shape)

			# Convert output to images
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
	# Rotation angles
	rotation = [math.radians(deg) for deg in [0, 55, 0]]
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
		input_image=f"{infile}",
		rotation=rotation,
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
		src_camera_ext=src_camera_ext,
		tgt_camera_ext=tgt_camera_ext
	)
	print("Outputs:", len(outputs))
	for i, output in enumerate(outputs):
		outfile = f"{infile.split('.png')[0]}_skel3d_{i + 1}.png"
		output.save(outfile)
		print(f"Saved output image #{i + 1} to '{outfile}'")