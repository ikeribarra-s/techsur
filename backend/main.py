from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import auth, producto, cliente, proveedor, compra, venta, permuta

app = FastAPI(title="TechSur API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(producto.router)
app.include_router(cliente.router)
app.include_router(proveedor.router)
app.include_router(compra.router)
app.include_router(venta.router)
app.include_router(permuta.router)


@app.get("/")
async def root():
    return {"status": "ok"}
