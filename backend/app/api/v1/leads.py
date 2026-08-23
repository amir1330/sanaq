import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import User, UserRole
from app.models.lead import Lead
from app.schemas.leads import LeadCreate, LeadOut, LeadStatusUpdate

router = APIRouter(tags=["leads"])
admin_only = roles(UserRole.super_admin)
PHONE_RE = re.compile(r"[^\d+]")


def normalize_phone(raw: str) -> str:
    cleaned = PHONE_RE.sub("", raw.strip())
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Укажи телефон полностью, с кодом страны")
    return cleaned


@router.post("/leads", response_model=LeadOut, status_code=201)
async def create_lead(body: LeadCreate, session: AsyncSession = Depends(get_session)):
    if body.website:
        return Lead(
            id=0,
            shop_name=body.shop_name.strip(),
            city=body.city.strip(),
            contact_name=body.contact_name.strip(),
            phone=body.phone.strip(),
            email=body.email,
            comment=body.comment,
            status="new",
            created_at=datetime.now(timezone.utc),
        )
    phone = normalize_phone(body.phone)
    since = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent = await session.execute(
        select(Lead.id).where(Lead.phone == phone, Lead.created_at >= since).limit(1)
    )
    if recent.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Заявка с этим телефоном уже есть. Мы свяжемся.")

    lead = Lead(
        shop_name=body.shop_name.strip(),
        city=body.city.strip(),
        contact_name=body.contact_name.strip(),
        phone=phone,
        email=body.email.strip() if body.email else None,
        comment=body.comment.strip() if body.comment else None,
        status="new",
    )
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return lead


@router.get("/admin/leads", response_model=list[LeadOut])
async def list_leads(
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Lead).order_by(Lead.created_at.desc()))
    return result.scalars().all()


@router.patch("/admin/leads/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: int,
    body: LeadStatusUpdate,
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена")
    lead.status = body.status
    await session.commit()
    await session.refresh(lead)
    return lead
