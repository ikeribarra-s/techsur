from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional
import uuid


class ProductoFotoSchema(BaseModel):
    id: uuid.UUID
    url: str
    orden: int
    model_config = ConfigDict(from_attributes=True)


class ProductoBase(BaseModel):
    nombre: str
    marca: str = "Apple"
    modelo: str
    storage: Optional[str] = None
    color: Optional[str] = None
    condicion: str = "usado"
    bateria_salud: Optional[int] = None
    precio_compra: Decimal
    precio_venta: Decimal
    estado: str = "disponible"
    notas: Optional[str] = None


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    storage: Optional[str] = None
    color: Optional[str] = None
    condicion: Optional[str] = None
    bateria_salud: Optional[int] = None
    precio_compra: Optional[Decimal] = None
    precio_venta: Optional[Decimal] = None
    estado: Optional[str] = None
    notas: Optional[str] = None


class ProductoResponse(ProductoBase):
    id: uuid.UUID
    fotos: list[ProductoFotoSchema] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ProductoPublic(BaseModel):
    id: uuid.UUID
    nombre: str
    marca: str
    modelo: str
    storage: Optional[str] = None
    color: Optional[str] = None
    condicion: str
    bateria_salud: Optional[int] = None
    precio_venta: Decimal
    notas: Optional[str] = None
    fotos: list[ProductoFotoSchema] = []
    model_config = ConfigDict(from_attributes=True)
