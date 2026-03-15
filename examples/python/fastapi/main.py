from fastapi import FastAPI
from ephem_debugger.middleware.fastapi import instrument, logger, close

app = FastAPI()
instrument(app, port=8000)
log = logger()


@app.get("/")
async def root():
    log.info("home page hit")
    return {"status": "ok", "framework": "fastapi"}


@app.get("/api/test")
async def test(id: str = "", error: bool = False):
    log.info("test endpoint id=%s", id)
    if error:
        log.error("test error triggered id=%s", id)
        return {"error": "test error", "id": id}
    return {"ok": True, "id": id}


@app.get("/api/users")
async def users():
    log.info("fetching users")
    return {"users": ["alice", "bob", "charlie"]}


@app.on_event("shutdown")
async def shutdown():
    close()
