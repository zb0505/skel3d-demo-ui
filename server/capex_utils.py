"""
CapeX Utils
Utility functions for the CapeX model
Initializes the CapeX model and exports a function to generate 2D skeletons for images using the model
For simplicity, the function adds static Z coordinates for the UI 3D preview
"""


# Imports
import torch
import random
import numpy as np
from os import path
from PIL import Image
from mmcv import Config
from mmcv.runner import load_checkpoint
from mmpose.models import build_posenet
from torchvision import transforms
from models import *
from tools.visualization import plot_query_results
from dotenv import dotenv_values

try:
	from .demo_text import Resize_Pad
except ImportError:
	from demo_text import Resize_Pad


# Current file location and config
CONFIG = dotenv_values() # Auto-find dotenv file
DIR = path.dirname(path.realpath(__file__))


# Init model and libraries
random.seed(0)
np.random.seed(0)
torch.manual_seed(0)

cfg = Config.fromfile(path.join(DIR, "configs/1shot-swin-clip/base_split1_config.py"))
cfg.data.test.test_mode = True
cfg.model.pretrained = path.join(DIR, cfg.model.pretrained)
print("[CapeX Utils] Config:", cfg)

preprocess = transforms.Compose([
	transforms.ToTensor(),
	transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
	Resize_Pad(cfg.model.encoder_config.img_size, cfg.model.encoder_config.img_size)
])

model_device = CONFIG["CAPEX_GPU"] if torch.cuda.is_available() else "cpu"

# Heatmap generator and configs
genHeatMap = TopDownGenerateTargetFewShot()
data_cfg = cfg.data_cfg
data_cfg["image_size"] = np.array([cfg.model.encoder_config.img_size, cfg.model.encoder_config.img_size])
data_cfg["joint_weights"] = None
data_cfg["use_different_joint_weights"] = False

# Load model
model = build_posenet(cfg.model)
load_checkpoint(model, path.join(DIR, "swin-gte-split1.pth"), map_location="cpu")
model.to(model_device)
model.eval()


# Generate skeleton points for the image
def generate_skeleton(input_image: Image.Image, keypoints: list[str], skeleton: list[tuple[int, int]]) -> tuple[np.ndarray[np.int64, np.int64], np.ndarray[np.int64, np.int64], dict]:
	# Load data
	query_img = np.array(input_image.convert("RGB"))

	# Just a placeholder, we don't have input keypoints
	kp_src = torch.zeros((len(keypoints), 2))
	
	if len(skeleton) == 0:
		skeleton = [(0, 0)]

	query_img = preprocess(query_img).flip(0)[None].to(model_device)
	
	kp_src_3d = torch.concatenate((kp_src, torch.zeros(kp_src.shape[0], 1)), dim=-1)
	kp_src_3d_weight = torch.concatenate((torch.ones_like(kp_src), torch.zeros(kp_src.shape[0], 1)), dim=-1)

	# Everything that is related to the support image is used as placeholder
	target_s, target_weight_s = genHeatMap._msra_generate_target(data_cfg, kp_src_3d, kp_src_3d_weight, sigma=1)
	target_s = torch.tensor(target_s).float()[None]
	target_weight_s = torch.tensor(target_weight_s).float()[None].to(model_device)

	data = {
		"img_s": [0],
		"img_q": query_img,
		"target_s": [target_s],
		"target_weight_s": [target_weight_s],
		"target_q": None,
		"target_weight_q": None,
		"return_loss": False,
		"img_metas": [{"sample_skeleton": [skeleton],
					   "query_skeleton": skeleton,
					   "sample_point_descriptions": np.array([keypoints]),
					   "sample_joints_3d": [kp_src_3d],
					   "query_joints_3d": kp_src_3d,
					   "sample_center": [kp_src.mean(dim=0)],
					   "query_center": kp_src.mean(dim=0),
					   "sample_scale": [kp_src.max(dim=0)[0] - kp_src.min(dim=0)[0]],
					   "query_scale": kp_src.max(dim=0)[0] - kp_src.min(dim=0)[0],
					   "sample_rotation": [0],
					   "query_rotation": 0,
					   "sample_bbox_score": [1],
					   "query_bbox_score": 1,
					   "query_image_file": "",
					   "sample_image_file": [""],
					   }]
	}

	with torch.no_grad():
		outputs = model(**data)
	
	# Visualize results when debugging
	if "/opt" not in path.realpath(__file__):
		vis_q_weight = target_weight_s[0]
		vis_q_image = query_img[0].detach().cpu().numpy().transpose(1, 2, 0)
		plot_query_results(vis_q_image, vis_q_weight, skeleton, torch.tensor(outputs['points']).squeeze(0), out_dir=path.join(path.basename(DIR), "output"))

	# Transform points from percentage to actual coordinates
	print("[CapeX Utils] Query img shape:", query_img.shape)
	#print("[CapeX Utils] VisQ img shape:", vis_q_image.shape)
	print("[CapeX Utils] Points shape:", outputs["points"].shape)
	output = outputs["points"][-1]
	output[:, 0] = output[:, 0] * input_image.width
	output[:, 1] = output[:, 1] * input_image.height
	orig_output = output.copy()

	# Mirror and centralize the skeleton so the UI can use it without additional transformations
	minX, minY = output[:, 0].min(), output[:, 1].min()
	maxX, maxY = output[:, 0].max(), output[:, 1].max()
	trX, trY = (maxX - minX) // 2, (maxY - minY) // 2
	output[:, 1] = output[:, 1] * -1 # Mirror on Y axis
	output[:, 0] = output[:, 0] - trX - minX
	output[:, 1] = output[:, 1] + trY + minY

	# Mirror the original output as well
	orig_output[:, 1] = orig_output[:, 1] * -1 # Mirror on Y axis

	# Add Z coordinates for 3D preview
	print("[CapeX Utils] Zeros shape:", np.zeros(output.shape[0]).shape)
	output = np.c_[output, np.zeros(output.shape[0])]

	return output.astype(np.int64), orig_output.astype(np.int64), outputs


# Generate skeleton points for example image when run directly
if __name__ == "__main__":
	infile = "../images/humanoid_figure.jpg"
	if not path.exists(infile): infile = "./images/humanoid_figure.jpg"
	outfile = f"{infile.split('.jpg')[0]}_skel.png"
	print(f"Generating masks for '{infile}'")
	output, orig_output = generate_skeleton(Image.open(f"{infile}"),
		"head, body, left elbow, left hand, right elbow, right hand, hips, left knee, left foot, right knee, right foot".split(", "),
		[(0, 1), (1, 2), (1, 4), (2, 3), (4, 5), (1, 6), (6, 7), (6, 9), (7, 8), (9, 10)])
	print("Output:", output)
	print("Model output:", orig_output)