"""
CapeX API tests
"""


# Imports
from capex_api import app
from fastapi.testclient import TestClient
from common_utils import Utils
from demo_models import CapeXOutput

# Initialize test client
client = TestClient(app)


# Endpoint tests
class TestCapeXAPI:
	# =================== Test route POST /predict ===================
	capex_json = {
		"image": Utils.load_image("images/humanoid_figure.jpg"),
		"keypoints": ["head", "body", "right arm", "left arm", "right leg", "left leg"],
		"skeleton": [(0, 1), (1, 2), (1, 3), (1, 4), (1, 5)]
	}

	# Successful response or router API failed to query CapeX API (schema validation)
	def test_predict_success(self):
		response = client.post("/predict", json=self.capex_json)
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, CapeXOutput)

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