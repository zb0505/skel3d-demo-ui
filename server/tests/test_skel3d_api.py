"""
Skel3D API tests
"""


# Imports
from skel3d_api import app
from fastapi.testclient import TestClient
from common_utils import Utils
from demo_models import Skel3DOutput

# Initialize test client
client = TestClient(app)


# Endpoint tests
class TestSkel3DAPI:
	# =================== Test route POST /predict ===================
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
	def test_predict_success(self):
		response = client.post("/predict", json=self.skel3d_json)
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, Skel3DOutput)
	
	# Incorrect input schema
	def test_predict_fail_422(self):
		response = client.post("/predict")
		assert response.status_code == 422, f"Response status code is {response.status_code}, expected 422"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == list, "Response 'detail' is not a list"
	
	# Incorrect method
	def test_predict_fail_405(self):
		response = client.get("/predict")
		assert response.status_code == 405, f"Response status code is {response.status_code}, expected 405"
		assert "detail" in response.json(), "Response does not contain 'detail' key"
		assert type(response.json()["detail"]) == str, "Response 'detail' is not a string"