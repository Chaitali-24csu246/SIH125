from fastapi import FastAPI

app = FastAPI(
    title="SIH 26125 Secure Asset Platform",
    version="0.1.0"
)

@app.get("/")
def root():
    return {
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}