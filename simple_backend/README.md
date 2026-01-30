Flask test server for frontend integration

Run:

1. Create a virtual environment (optional):

   python3 -m venv venv
   source venv/bin/activate

2. Install dependencies:

   pip install -r requirements.txt

3. Start the server:

   python app.py

The server will run on http://localhost:5000 and exposes dummy User Management endpoints:
- GET /users/me
- GET /users/<id>
- PUT /users/me/username
- POST /users/me/email/request-change
- PUT /users/me/email
- PUT /users/me/password
- POST /users/me/register-pod
- PUT /users/me/update-pod
- DELETE /users/me/unregister-pod


