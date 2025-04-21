"""
Skel3D model initializer script
This way Skel3D V1 and V2 share the same model which reduces the required amount of GPU VRAM
"""


# Imports
import os, torch
import numpy as np
from PIL import Image
from omegaconf import OmegaConf
from pytorch_lightning import seed_everything
from utils.util import instantiate_from_config
from datasets.objaverse_hdf5_coord import ObjaverseHDF5CoordDataset, sort_joints_by_length_and_degree_normalized
from utils.sam_utils import sam_init
from dotenv import dotenv_values


# Customized dataset class for processing content from API
class DataProvider(ObjaverseHDF5CoordDataset):
	def __init__(self, root_dir: str, cfg: OmegaConf, debug: bool = False) -> None:
		super().__init__(root_dir, cfg, debug)

	# Prevent reading dataset file
	def read_samples(self):
		return None
	
	# Transform extrinsic matrices
	def transform_extrinsics(self, extrinsics: np.ndarray | list[np.ndarray]) -> np.ndarray:
		"""
		Transforms extrinsic matrices so that source matrix will be identity and target matrix will be relative to that
		with the original rotation applied.
		Args:
			extrinsics: extrinsic matrices in 3x4 format
		Returns: transformed extrinsic matrices in 3x4 format
		"""
		# Extract source and target camera
		src_cam, tgt_cam = extrinsics[0], extrinsics[1]

		# Convert extrinsics from 3x4 to 4x4 matrices
		src_cam_4x4, tgt_cam_4x4 = np.eye(4), np.eye(4)
		src_cam_4x4[:3, :] = src_cam
		tgt_cam_4x4[:3, :] = tgt_cam

		# Set translation vectors to static vectors
		src_cam_4x4[:, 3] = np.array([0, 0, 4, 1])
		tgt_cam_4x4[:, 3] = np.array([0, 0, 4, 1])

		# Calculate source inverse and target relative to source with original rotation
		src_cam_4x4_inv = np.linalg.inv(src_cam_4x4)
		src_cam_4x4 = np.dot(src_cam_4x4_inv, src_cam_4x4)
		tgt_cam_4x4 = np.dot(src_cam_4x4_inv, tgt_cam_4x4)

		# Return extrinsics as 3x4 matrices
		return np.array([src_cam_4x4[:3, :], tgt_cam_4x4[:3, :]])

	# Override data preparation function (this will be used to prepare input data)
	def pre_data(self, data):
		"""
		Data preparation function
		Args:
			data: input data in the following format:
				{
					"image": PIL image object (before conversion, direct output of Image.open()),
					"bones": bones array with pairs (shape: (N, 2)),
					"joints": joints array with 3D coordinates (shape: (N, 3)),
					"src_camera": source view camera extrinsic matrix (numpy array, shape: (3, 4)),
					"tgt_camera": target view camera extrinsic matrix (numpy array, shape: (3, 4)),
				}
			Returns: object suitable for the model in the following format:
				{
					"imgs": image tensor,
					"skels": skeleton tensor,
					"w2cs": world-to-camera matrix,
					"c2ws": camera-to-world matrix,
					"intrinsics": intrinsic matrix
				}
		"""
		imgs = []
		w2cs = []
		intrinsics = []
		
		bones = torch.tensor(np.array(data["bones"]))
		joints = torch.tensor(data["joints"]).float()

		if bones.shape[0] > 0:
			sorted_ids = sort_joints_by_length_and_degree_normalized(joints, bones)            
		else:
			sorted_ids = torch.arange(joints.shape[0]).unsqueeze(0)

		joints_2ds = []
		obj_names = []

		# Make sure image is 1:1 aspect ratio
		img = np.array(data["image"].convert("RGBA"))
		if img.shape[0] != img.shape[1]:
			size = max(img.shape[0], img.shape[1])
			bg = np.zeros((size, size, 4), dtype=np.uint8)
			posX = (size - img.shape[1]) // 2
			posY = (size - img.shape[0]) // 2
			# Paste image in the center of the background
			bg[posY:posY + img.shape[0], posX:posX + img.shape[1], :] = img
			img = bg # Set image to filled image
		
		# Apply color transformations
		img_loaded = self.load_im_hdf5(img / 255.)
		# Save each image step when debugging
		if "/opt" not in os.path.realpath(__file__):
			Image.fromarray(img, "RGBA").save("tmp_input_padded_skel3d.png")
			img_loaded.save("tmp_input_processed_skel3d.png")
		# Apply image transformations
		img = self.process_img(img_loaded).unsqueeze(0)

		# Append target camera view
		for cam_id in ["src", "tgt"]:
			obj_names.append(f"img_{cam_id}")
			imgs.append(img)
			
			w2c_gl = data[f"{cam_id}_camera"]
			joints_2d = self.project_joints_to_2d(joints, extrinsic=torch.tensor(w2c_gl).float()) 
			
			joints_2d = joints_2d[sorted_ids[0, :self.used_joints]]
			joints_2ds.append(joints_2d)
						
			w2cs.append(w2c_gl)
			focal = .5 / np.tan(.5 * 0.8575560450553894)
			intrinsics.append(np.array([[focal, 0.0, 1.0 / 2.0],
										[0.0, focal, 1.0 / 2.0],
										[0.0, 0.0, 1.0]]))           
			
		imgs = torch.cat(imgs)
		skels = torch.zeros_like(imgs)

		#skels = torch.cat(skels)
		joints_2ds = torch.stack(joints_2ds)

		# take the joints for the first image       
		joints_first = joints_2ds[0]   
		# Get the indeces of the joints that are outside the image
		outside = (joints_first[:, 0] < 0) | (joints_first[:, 0] >= self.image_size) | (joints_first[:, 1] < 0) | (joints_first[:, 1] >= self.image_size)
		# Remove the joints that are outside the image
		joints_2ds = joints_2ds[:, ~outside, :]

		# Clamp the other joints to the image size
		joints_2ds[:, :, 0] = torch.clamp(joints_2ds[:, :, 0], 0, self.image_size - 1)
		joints_2ds[:, :, 1] = torch.clamp(joints_2ds[:, :, 1], 0, self.image_size - 1)

		joints_2ds = torch.cat([joints_2ds, joints_2ds[:, -1:, :].repeat(1, self.used_joints - joints_2ds.size(1), 1)], dim=1)

		if joints_2d.size(1) != self.used_joints:
			joints_2d = torch.zeros((joints_2ds.size(0), self.used_joints, 2), dtype=joints_2ds.dtype, device=joints_2ds.device) 

		x = joints_2ds[:, :, 0].long().reshape(-1)
		y = joints_2ds[:, :, 1].long().reshape(-1)

		view_indices = torch.arange(len(joints_2ds)).unsqueeze(1).expand(-1, joints_2ds.shape[1]).reshape(-1)
		src_view_indices = torch.ones_like(view_indices) * 0

		src_x = joints_2ds[0, :, 0].long().repeat(len(joints_2ds))
		src_y = joints_2ds[0, :, 1].long().repeat(len(joints_2ds))

		skels[view_indices, y, x] = imgs[src_view_indices, src_y, src_x]

		intrinsics = torch.tensor(np.array(intrinsics)).to(imgs)
		w2cs = torch.tensor(self.transform_extrinsics(np.array(w2cs))).to(imgs)
		w2cs_gl = torch.eye(4).unsqueeze(0).repeat(imgs.size(0),1,1)
		w2cs_gl[:,:3,:] = w2cs
		# camera poses in .npy files are in OpenGL convention: 
		#     x right, y up, z into the camera (backward),
		# need to transform to COLMAP / OpenCV:
		#     x right, y down, z away from the camera (forward)
		w2cs = torch.einsum("nj, bjm-> bnm", self.opengl_to_colmap, w2cs_gl)
		c2ws = torch.linalg.inv(w2cs)
		camera_centers = c2ws[:, :3, 3].clone()
		# fix the distance of the source camera to the object / world center
		if torch.norm(camera_centers[0]) <= 1e-5:
			# Set new camera distance in all directions
			w2cs_gl[:, :3, 3] = 2.0
			w2cs = torch.einsum("nj, bjm-> bnm", self.opengl_to_colmap, w2cs_gl)
			c2ws = torch.linalg.inv(w2cs)
			camera_centers = c2ws[:, :3, 3].clone()
		assert torch.norm(camera_centers[0]) > 1e-5, "Camera center is too close to the object center"
		translation_scaling_factor = 2.0 / torch.norm(camera_centers[0])
		w2cs[:, :3, 3] *= translation_scaling_factor
		c2ws[:, :3, 3] *= translation_scaling_factor
		camera_centers *= translation_scaling_factor

		# Return data in a suitable format for the model
		# Also make sure data shape is (batch_size, ...shape) where batch size is 1
		return {
			"images": imgs.reshape(1, *imgs.shape),
			"skeletons": skels.reshape(1, *skels.shape),
			"w2cs": w2cs.reshape(1, *w2cs.shape),
			"c2ws": c2ws.reshape(1, *c2ws.shape),
			"intrinsics": intrinsics.reshape(1, *intrinsics.shape),
			"filename": obj_names
		}


# Load and init model and data provider
CONFIG = dotenv_values() # Auto-find dotenv file
device_skel3d = CONFIG["SKEL3D_MODEL_GPU"] if torch.cuda.is_available() else "cpu"
device_sam = (CONFIG["SKEL3D_SAM_GPU"] if torch.cuda.is_available() else "cpu").split(":")
torch.cuda.set_device(device_skel3d)
config = OmegaConf.load("configs/objaverse_hdf5_skel_coord.yaml")
data_provider = DataProvider("", config.data.params.validation, False)
seed_everything(42)

models = dict()
config["model"]["params"]["ckpt_path"] = "skel3d_coord.ckpt"
# load stable diffusion model
print('Instantiating LatentDiffusion...')
model = instantiate_from_config(config.model)
model.to(device_skel3d)
model.eval()
models['free3d'] = model
# background removal model
print('Instantiating SAM model...')
# Path below must be relative to SAM loader script (which is inside the utils folder)
models['sam'] = sam_init(int(device_sam[1]) if len(device_sam) > 1 else 0, "../sam_checkpoint.pth")