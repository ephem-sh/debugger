from flask import Flask, request, jsonify
from ephem_debugger.middleware.flask import init_debugger, logger, close

app = Flask(__name__)
init_debugger(app, port=5000)
log = logger()


@app.get("/")
def index():
    log.info("home page hit")
    return jsonify(status="ok", framework="flask")


@app.get("/api/test")
def test():
    id = request.args.get("id", "")
    log.info("test endpoint id=%s", id)
    if request.args.get("error") == "true":
        log.error("test error triggered id=%s", id)
        return jsonify(error="test error", id=id), 500
    return jsonify(ok=True, id=id)


@app.get("/api/users")
def users():
    log.info("fetching users")
    return jsonify(users=["alice", "bob", "charlie"])


if __name__ == "__main__":
    try:
        app.run(port=5000, debug=True)
    finally:
        close()
