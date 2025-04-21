"""
Main router API tests
"""


# Imports
from demo_api import app, API_KEY
from fastapi.testclient import TestClient
from common_utils import Utils
from demo_models import SAM2Output, CapeXOutput, MeTRAbsOutput, Skel3DOutput

# Initialize test client
client = TestClient(app)


# Endpoint tests
class TestDemoAPI:
	# =================== Test route GET / ===================
	# Successful response
	def test_index_success(self):
		response = client.get("/")
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		assert "version" in response.json(), "Response does not contain 'version' key"
		assert type(response.json()["version"]) == str, "Response 'version' is not a string"

	# Incorrect method
	def test_index_fail_405(self):
		response = client.post("/", json={ "example": "data" })
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"


	# ============== Test route POST /segmentate ==============
	sam2_json = {
		"image": Utils.load_image("images/humanoid_figure.jpg"),
		"points": {
			"positive": [(0, 0), (1, 1)],
			"negative": [(2, 2), (3, 3)]
		}
	}

	# Successful response or router API failed to query SAM2 API (schema validation)
	def test_segmentate_success(self):
		response = client.post("/segmentate", json=self.sam2_json, headers={ "Authorization": API_KEY })
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, SAM2Output)

	# Incorrect input schema
	def test_segmentate_fail_422(self):
		response = client.post("/segmentate", headers={ "Authorization": API_KEY })
		assert response.status_code == 422, f"Response status code is {response.status_code}, expected 422"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == list, "Response 'detail' is not a list"

	# Unauthorized request
	def test_segmentate_fail_401(self):
		response = client.post("/segmentate", json=self.sam2_json)
		assert response.status_code == 401, f"Response status code is {response.status_code}, expected 401"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"

	# Incorrect method
	def test_segmentate_fail_405(self):
		response = client.get("/segmentate")
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"


	# ============== Test route POST /skeleton ==============
	metrabs_json = {
		"image": Utils.load_image("images/humanoid_figure.jpg"),
		"bbox": None
	}

	# Successful response or router API failed to query MeTRAbs API (schema validation)
	def test_skeleton_success(self):
		response = client.post("/skeleton", json=self.metrabs_json, headers={ "Authorization": API_KEY })
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, MeTRAbsOutput)

	# Incorrect input schema
	def test_skeleton_fail_422(self):
		response = client.post("/skeleton", headers={ "Authorization": API_KEY })
		assert response.status_code == 422, f"Response status code is {response.status_code}, expected 422"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == list, "Response 'detail' is not a list"

	# Unauthorized request
	def test_skeleton_fail_401(self):
		response = client.post("/skeleton", json=self.metrabs_json)
		assert response.status_code == 401, f"Response status code is {response.status_code}, expected 401"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"

	# Incorrect method
	def test_skeleton_fail_405(self):
		response = client.get("/skeleton")
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"


	# ========== Test route POST /skeleton_capex ==========
	capex_json = {
		"image": Utils.load_image("images/humanoid_figure.jpg"),
		"keypoints": ["head", "body", "right arm", "left arm", "right leg", "left leg"],
		"skeleton": [(0, 1), (1, 2), (1, 3), (1, 4), (1, 5)]
	}

	# Successful response or router API failed to query CapeX API (schema validation)
	def test_skeleton_capex_success(self):
		response = client.post("/skeleton_capex", json=self.capex_json, headers={ "Authorization": API_KEY })
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, CapeXOutput)

	# Incorrect input schema
	def test_skeleton_capex_fail_422(self):
		response = client.post("/skeleton_capex", headers={ "Authorization": API_KEY })
		assert response.status_code == 422, f"Response status code is {response.status_code}, expected 422"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == list, "Response 'detail' is not a list"

	# Unauthorized request
	def test_skeleton_capex_fail_401(self):
		response = client.post("/skeleton_capex", json=self.capex_json)
		assert response.status_code == 401, f"Response status code is {response.status_code}, expected 401"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"

	# Incorrect method
	def test_skeleton_capex_fail_405(self):
		response = client.get("/skeleton_capex")
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"


	# =============== Test route POST /skel3d ===============
	skel3d_json = {
		"image": Utils.load_image("images/humanoid_figure_cutout.png", "RGBA"),
		"joints": [
			[  -56,  -145,  2071 ],
			[    2,   -45,  2124 ],
			[ -124,   -47,  2068 ],
			[  -62,  -263,  2075 ],
			[   60,   333,  2114 ],
			[ -192,   316,  2049 ],
			[  -49,  -431,  2014 ],
			[    5,   708,  2319 ],
			[ -237,   704,  2245 ],
			[  -33,  -459,  1984 ],
			[   87,   789,  2250 ],
			[ -236,   794,  2143 ],
			[   -5,  -657,  1897 ],
			[   62,  -592,  1983 ],
			[ -104,  -575,  1909 ],
			[   16,  -685,  1833 ],
			[  166,  -587,  2019 ],
			[ -195,  -556,  1859 ],
			[  179,  -389,  2206 ],
			[ -304,  -343,  1938 ],
			[  264,  -133,  2224 ],
			[ -385,  -110,  1912 ],
			[  290,   -47,  2255 ],
			[ -415,   -27,  1920 ]
		],
		"bones": [ [ 1,  4], [ 1,  0], [ 2,  5], [ 2,  0], [ 3,  6], [ 3,  0],
			[ 4,  7], [ 5,  8], [ 6,  9], [ 7, 10], [ 8, 11], [ 9, 12],
			[12, 13], [12, 14], [12, 15], [13, 16], [14, 17], [16, 18],
			[17, 19], [18, 20], [19, 21], [20, 22], [21, 23]
		],
		"src_camera": [
			[1.0, 0.0, 0.0, 0.0],
			[0.0, 1.0, 0.0, 0.0],
			[0.0, 0.0, 1.0, 4.0],
			[0.0, 0.0, 0.0, 1.0]
		],
		"target_camera": [
			[0.7071, 0.0, -0.7071, 0.0],
			[0.0, 1.0, 0.0, 0.0],
			[0.7071, 0.0, 0.7071, 4.0],
			[0.0, 0.0, 0.0, 1.0]
		]
	}

	# Successful response or router API failed to query Skel3D API (schema validation)
	def test_skel3d_success(self):
		response = client.post("/skel3d", json=self.skel3d_json, headers={ "Authorization": API_KEY })
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, Skel3DOutput)

	# Incorrect input schema
	def test_skel3d_fail_422(self):
		response = client.post("/skel3d", headers={ "Authorization": API_KEY })
		assert response.status_code == 422, f"Response status code is {response.status_code}, expected 422"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == list, "Response 'detail' is not a list"

	# Unauthorized request
	def test_skel3d_fail_401(self):
		response = client.post("/skel3d", json=self.skel3d_json)
		assert response.status_code == 401, f"Response status code is {response.status_code}, expected 401"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"

	# Incorrect method
	def test_skel3d_fail_405(self):
		response = client.get("/skel3d")
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"