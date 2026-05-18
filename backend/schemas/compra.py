from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
import uuid


class CompraBase(BaseModel):
    proveedor_id: Optional[uuid.UUID] = None
    producto_id: uuid.UUID
    precio_unitario: Decimal
    fecha_compra: date
    forma_pago: str = "efectivo"
    notas: Optional[str] = None


class CompraCreate(CompraBase):
    pass


class CompraResponse(CompraBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
