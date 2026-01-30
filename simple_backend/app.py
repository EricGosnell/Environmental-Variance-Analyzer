from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

"""
Basic test server implementing the User Management routes from Documentation/API_routes.md.
All endpoints return dummy data suitable for frontend integration testing.
"""

_DUMMY_USER = {
    "id": "123",
    "email": "user@example.com",
    "username": "user",
    "pods": ["pod-3"],
    "podData": ["data-3-1"],
}


@app.route("/users/me", methods=["GET"])
def get_current_user():
    """GET /users/me -> returns dummy current user"""
    return jsonify({"user": _DUMMY_USER}), 200


@app.route("/users/<user_id>", methods=["GET"])
def get_user_by_id(user_id: str):
    """GET /users/{id} -> returns dummy user with the requested id"""
    user = dict(_DUMMY_USER)
    user["id"] = user_id
    user["createdAt"] = "2021-01-01T00:00:00.000Z"
    return jsonify({"user": user}), 200


@app.route("/users/me/username", methods=["PUT"])
def update_username():
    """PUT /users/me/username -> accepts JSON { username }"""
    data = request.get_json(force=True, silent=True) or {}
    username = data.get("username")
    if not username or not isinstance(username, str):
        return jsonify({"error": "Invalid username format"}), 400
    # Dummy success response
    return jsonify({"message": "Username updated successfully"}), 200


@app.route("/users/me/email/request-change", methods=["POST"])
def request_email_change():
    """POST /users/me/email/request-change -> accepts JSON { newEmail }"""
    data = request.get_json(force=True, silent=True) or {}
    new_email = data.get("newEmail")
    if not new_email or not isinstance(new_email, str):
        return jsonify({"error": "Invalid email format"}), 400
    return jsonify({"message": "Verification code sent to new email"}), 200


@app.route("/users/me/email", methods=["PUT"])
def verify_and_update_email():
    """PUT /users/me/email -> accepts JSON { newEmail, verificationCode }"""
    data = request.get_json(force=True, silent=True) or {}
    new_email = data.get("newEmail")
    verification_code = data.get("verificationCode")
    if not new_email or not verification_code:
        return jsonify({"error": "Invalid or expired verification code"}), 400
    # Dummy success
    return jsonify({"message": "Email updated successfully", "user": {"email": new_email}}), 200


@app.route("/users/me/password", methods=["PUT"])
def update_password():
    """PUT /users/me/password -> accepts JSON { oldPassword, newPassword }"""
    data = request.get_json(force=True, silent=True) or {}
    old_password = data.get("oldPassword")
    new_password = data.get("newPassword")
    if not old_password or not new_password:
        return jsonify({"error": "Invalid old password"}), 400
    return jsonify({"message": "Password updated successfully"}), 200


@app.route("/users/me/register-pod", methods=["POST"])
def register_pod():
    """POST /users/me/register-pod -> accepts pod registration JSON"""
    data = request.get_json(force=True, silent=True) or {}
    pod_id = data.get("podId")
    nickname = data.get("nickname")
    visibility = data.get("visibility")
    if not pod_id or not nickname or visibility not in ("public", "private"):
        return jsonify({"message": "Pod already registered"}), 409
    return jsonify({"message": "Pod registered successfully"}), 200


@app.route("/users/me/update-pod", methods=["PUT"])
def update_pod():
    """PUT /users/me/update-pod -> accepts pod update JSON"""
    data = request.get_json(force=True, silent=True) or {}
    pod_id = data.get("podId")
    if not pod_id:
        return jsonify({"error": "Pod not found"}), 404
    return jsonify({"message": "Pod updated successfully"}), 200


@app.route("/users/me/unregister-pod", methods=["DELETE"])
def unregister_pod():
    """DELETE /users/me/unregister-pod -> accepts JSON { podId }"""
    data = request.get_json(force=True, silent=True) or {}
    pod_id = data.get("podId")
    if not pod_id:
        return jsonify({"error": "Pod not registered or found"}), 404
    return jsonify({"message": "Pod unregistered successfully"}), 200


@app.route("/pods/locations", methods=["GET"])
def get_pod_locations():
    """GET /pods/locations -> returns dummy pod locations"""
    # This test endpoint ignores query params and returns fixed sample pods
    pods = [
        {
            "id": "pod-1",
            "nickname": "Station Alpha",
            "latitude": 40.005928,
            "longitude": -105.267548,
            "visibility": "public",
            "lastUpdated": "2026-01-01T00:00:00.000Z",
        },
        {
            "id": "pod-2",
            "nickname": "Station Beta",
            "latitude": 40.011139,
            "longitude": -105.268776,
            "visibility": "public",
            "lastUpdated": "2026-01-02T00:00:00.000Z",
        },
        {
            "id": "pod-3",
            "nickname": "Station Gamma",
            "latitude": 39.993723,
            "longitude": -105.285723,
            "visibility": "private",
            "lastUpdated": "2026-01-03T00:00:00.000Z",
        },
    ]
    return jsonify({"pods": pods}), 200


@app.route("/pods/<pod_id>/data", methods=["GET"])
def get_pod_data(pod_id: str):
    """GET /pods/{id}/data -> returns dummy pod data"""
    # Return different fake data based on pod ID
    if pod_id == "pod-1":
        pod_info = {
            "id": "pod-1",
            "nickname": "Station Alpha",
            "latitude": 40.005928,
            "longitude": -105.267548,
            "visibility": "public",
            "lastUpdated": "2026-01-01T00:00:00.000Z",
        }
        data = [
            {
                "id": "data-1-1",
                "timestamp": "2026-01-01T12:00:00.000Z",
                "data": {
                    "sensor_data_id": "sensor-1-1",
                    "pod_data_id": "pod_data_1",
                    "sensor_type": "temperature",
                    "reading_value": 22.5,
                    "reading_units": "C",
                    "reading_timestamp": "2026-01-01T12:00:00.000Z",
                    "raw_data": {"device_id": "temp-sensor-001", "calibration": 0.1},
                    "created_at": "2026-01-01T12:00:00.000Z",
                },
                "visibility": "public",
            },
            {
                "id": "data-1-2",
                "timestamp": "2026-01-01T11:00:00.000Z",
                "data": {
                    "sensor_data_id": "sensor-1-2",
                    "pod_data_id": "pod_data_1",
                    "sensor_type": "humidity",
                    "reading_value": 65.3,
                    "reading_units": "%",
                    "reading_timestamp": "2026-01-01T11:00:00.000Z",
                    "raw_data": {"device_id": "humidity-sensor-001", "calibration": 0.0},
                    "created_at": "2026-01-01T11:00:00.000Z",
                },
                "visibility": "public",
            },
            {
                "id": "data-1-3",
                "timestamp": "2026-01-01T10:00:00.000Z",
                "data": {
                    "sensor_data_id": "sensor-1-3",
                    "pod_data_id": "pod_data_1",
                    "sensor_type": "air_quality",
                    "reading_value": 45.2,
                    "reading_units": "AQI",
                    "reading_timestamp": "2026-01-01T10:00:00.000Z",
                    "raw_data": {"device_id": "aq-sensor-001", "pm2_5": 12.3, "pm10": 18.7},
                    "created_at": "2026-01-01T10:00:00.000Z",
                },
                "visibility": "public",
            },
        ]
    elif pod_id == "pod-2":
        pod_info = {
            "id": "pod-2",
            "nickname": "Station Beta",
            "latitude": 40.011139,
            "longitude": -105.268776,
            "visibility": "public",
            "lastUpdated": "2026-01-02T00:00:00.000Z",
        }
        data = []
    elif pod_id == "pod-3":
        pod_info = {
            "id": "pod-3",
            "nickname": "Station Gamma",
            "latitude": 39.993723,
            "longitude": -105.285723,
            "visibility": "private",
            "lastUpdated": "2026-01-03T00:00:00.000Z",
        }
        data = [
            {
                "id": "data-3-1",
                "timestamp": "2026-01-03T16:00:00.000Z",
                "data": {
                    "sensor_data_id": "sensor-3-1",
                    "pod_data_id": "pod_data_3",
                    "sensor_type": "temperature",
                    "reading_value": 21.2,
                    "reading_units": "C",
                    "reading_timestamp": "2026-01-03T16:00:00.000Z",
                    "raw_data": {"device_id": "temp-sensor-003", "calibration": -0.1},
                    "created_at": "2026-01-03T16:00:00.000Z",
                },
                "visibility": "private",
            },
        ]
    else:
        return jsonify({"error": "Pod not found"}), 404
    
    response = dict(pod_info)
    response["data"] = data
    return jsonify(response), 200


if __name__ == "__main__":
    # Run in debug mode for local testing
    app.run(host="0.0.0.0", port=5050, debug=True)


