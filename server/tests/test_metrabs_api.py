"""
MeTRAbs API tests
"""


# Imports
from metrabs_api import app
from fastapi.testclient import TestClient
from common_utils import Utils
from demo_models import MeTRAbsOutput

# Initialize test client
client = TestClient(app)


# Endpoint tests
class TestMeTRAbsAPI:
	# =================== Test route POST /predict ===================
	metrabs_json = {
		"image": Utils.load_image("images/humanoid_figure.jpg"),
		"bbox": None
	}

	# Successful response or router API failed to query MeTRAbs API (schema validation)
	def test_predict_success(self):
		response = client.post("/predict", json=self.metrabs_json)
		assert response.status_code == 200, f"Response failed with status code {response.status_code}"
		resp = response.json()
		assert Utils.validate_schema(resp, MeTRAbsOutput)

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