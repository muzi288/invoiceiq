"""Convert invoice amounts to tenant default currency using Frankfurter FX rates."""
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import httpx

logger = logging.getLogger(__name__)

_CACHE_TTL = timedelta(hours=6)
_rate_cache: dict[str, tuple[datetime, dict[str, Decimal]]] = {}


def _normalize(code: str | None) -> str:
    return (code or "USD").strip().upper()


def _cache_key(base: str, rate_date: date | None) -> str:
    if rate_date:
        return f"{base}:{rate_date.isoformat()}"
    return f"{base}:latest"


async def _get_rates(base: str, rate_date: date | None = None) -> dict[str, Decimal]:
    base = _normalize(base)
    key = _cache_key(base, rate_date)
    now = datetime.now(timezone.utc)
    cached = _rate_cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    async with httpx.AsyncClient(timeout=10) as client:
        if rate_date:
            url = f"https://api.frankfurter.dev/v1/{rate_date.isoformat()}"
        else:
            url = "https://api.frankfurter.dev/v1/latest"
        resp = await client.get(url, params={"base": base})
        resp.raise_for_status()
        data = resp.json()

    rates = {k.upper(): Decimal(str(v)) for k, v in data.get("rates", {}).items()}
    rates[base] = Decimal("1")
    _rate_cache[key] = (now, rates)
    return rates


def _resolve_rate_date(
    invoice_date: date | None,
    fallback_date: date | datetime | None = None,
) -> date | None:
    """Use invoice issue date for FX; fall back to upload date."""
    if invoice_date:
        return invoice_date
    if isinstance(fallback_date, datetime):
        return fallback_date.date()
    return fallback_date


async def convert_amount(
    amount: Decimal | float | int | None,
    from_currency: str | None,
    to_currency: str,
    *,
    rate_date: date | None = None,
) -> tuple[Decimal | None, bool]:
    """
    Convert amount to target currency using the rate on rate_date (or latest).
    Returns (converted_amount, was_converted).
    """
    if amount is None:
        return None, False

    source = _normalize(from_currency)
    target = _normalize(to_currency)
    value = Decimal(str(amount))

    if source == target:
        return value.quantize(Decimal("0.01"), ROUND_HALF_UP), False

    try:
        rates = await _get_rates(source, rate_date)
        if target not in rates:
            logger.warning("[fx] No rate from %s to %s", source, target)
            return None, False
        converted = value * rates[target]
        return converted.quantize(Decimal("0.01"), ROUND_HALF_UP), True
    except Exception as exc:
        logger.warning("[fx] Conversion failed %s→%s: %s", source, target, exc)
        return None, False


async def display_amount_for_invoice(
    amount: Decimal | float | int | None,
    currency: str | None,
    tenant_currency: str,
    *,
    invoice_date: date | None = None,
    fallback_date: date | datetime | None = None,
) -> dict:
    """Build display_amount fields for list/summary views."""
    rate_date = _resolve_rate_date(invoice_date, fallback_date)
    display_amount, amount_converted = await convert_amount(
        amount, currency, tenant_currency, rate_date=rate_date,
    )
    if (
        display_amount is None
        and amount is not None
        and currency
        and _normalize(currency) == _normalize(tenant_currency)
    ):
        display_amount = Decimal(str(amount)).quantize(Decimal("0.01"), ROUND_HALF_UP)

    return {
        "display_amount": display_amount,
        "display_currency": tenant_currency,
        "amount_converted": amount_converted,
    }


async def prefetch_rates(
    currencies: set[str],
    target: str,
    rate_dates: set[date] | None = None,
) -> None:
    """Warm cache for currencies (and optional historical dates) on a list response."""
    target = _normalize(target)
    dates = rate_dates or {None}
    for code in currencies:
        if _normalize(code) == target:
            continue
        for rate_date in dates:
            try:
                await _get_rates(code, rate_date)
            except Exception as exc:
                logger.warning("[fx] Prefetch failed for %s: %s", code, exc)
