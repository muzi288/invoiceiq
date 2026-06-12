from pydantic import BaseModel
from decimal import Decimal


class LineItemInput(BaseModel):
    description: str | None = None
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    total_price: Decimal | None = None
    currency: str = "USD"


class LineItemsUpdate(BaseModel):
    line_items: list[LineItemInput]
