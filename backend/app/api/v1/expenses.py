from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import Expense, User, UserRole
from app.schemas.expense import ExpenseCreate, ExpenseOut
from app.services.access import assert_shop_access

router = APIRouter(tags=["expenses"])
manage = roles(UserRole.super_admin, UserRole.owner)


@router.get("/shops/{shop_id}/expenses", response_model=list[ExpenseOut])
async def list_expenses(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, le=500),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Expense)
        .where(Expense.shop_id == shop_id)
        .order_by(Expense.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/shops/{shop_id}/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(
    shop_id: int,
    body: ExpenseCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    expense = Expense(
        shop_id=shop_id,
        category=body.category,
        amount=body.amount,
        comment=body.comment,
        created_by=user.id,
    )
    session.add(expense)
    await session.commit()
    await session.refresh(expense)
    return expense
