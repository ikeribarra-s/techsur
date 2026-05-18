from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import httpx
import time
from backend.database import get_db
from backend.config import settings
from backend.auth import verify_token
from backend.models.producto import Producto
from backend.models.producto_foto import ProductoFoto
from backend.schemas.producto import ProductoCreate, ProductoUpdate, ProductoResponse, ProductoPublic

router = APIRouter(prefix="/productos", tags=["Productos"])


def _detect_image(header: bytes) -> tuple[str, str] | None:
    """Return (extension, mime_type) based on magic bytes, or None if not an allowed image."""
    if header[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


@router.get("/", response_model=List[ProductoResponse])
async def list_productos(
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    q = select(Producto)
    if estado:
        q = q.where(Producto.estado == estado)
    result = await db.execute(q.order_by(Producto.created_at.desc()))
    return result.scalars().all()


@router.get("/public", response_model=List[ProductoPublic])
async def list_productos_public(db: AsyncSession = Depends(get_db)):
    q = select(Producto).where(Producto.estado == "disponible")
    result = await db.execute(q.order_by(Producto.created_at.desc()))
    return result.scalars().all()


@router.get("/{id}", response_model=ProductoResponse)
async def get_producto(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return p


@router.post("/", response_model=ProductoResponse, status_code=201)
async def create_producto(
    data: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = Producto(**data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/{id}", response_model=ProductoResponse)
async def update_producto(
    id: str,
    data: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
async def delete_producto(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if p.estado == "vendido":
        raise HTTPException(status_code=409, detail="No se puede eliminar un producto vendido")
    await db.delete(p)
    await db.commit()


@router.post("/{id}/foto", response_model=ProductoResponse)
async def upload_foto(
    id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Almacenamiento no configurado (SUPABASE_URL / SUPABASE_KEY)")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"El archivo supera el límite de {settings.MAX_UPLOAD_MB} MB.")

    detected = _detect_image(content[:12])
    if detected is None:
        raise HTTPException(status_code=415, detail="Formato no permitido. Solo se aceptan JPEG, PNG y WebP.")
    ext, mime_type = detected

    filename = f"{id}_{int(time.time() * 1000)}.{ext}"

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/product-photos/{filename}",
            content=content,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Content-Type": mime_type,
                "x-upsert": "true",
            },
        )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail="Error al subir imagen.")

    url = f"{settings.SUPABASE_URL}/storage/v1/object/public/product-photos/{filename}"
    foto = ProductoFoto(producto_id=p.id, url=url, orden=len(p.fotos))
    db.add(foto)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{id}/fotos/{foto_id}", status_code=204)
async def delete_foto(
    id: str,
    foto_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    foto = await db.get(ProductoFoto, foto_id)
    if not foto or str(foto.producto_id) != id:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    await db.delete(foto)
    await db.commit()
