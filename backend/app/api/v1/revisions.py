from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import User, UserRole
from app.schemas.stock import (
    StockRevisionCreate,
    StockRevisionLineOut,
    StockRevisionOut,
    StockRevisionUpdate,
)
from app.services.access import assert_shop_access
from app.services.revision_xlsx import build_revision_xlsx
from app.services.revisions import (
    cancel_revision,
    create_revision,
    line_difference,
    line_value,
    list_revisions,
    load_revision,
    post_revision,
    revision_summary,
    save_revision,
)

router = APIRouter(tags=["stock-revisions"])
manage = roles(UserRole.super_admin, UserRole.owner)


async def _names(session: AsyncSession, *user_ids: int | None) -> dict[int, str]:
    ids = [i for i in user_ids if i is not None]
    if not ids:
        return {}
    rows = (await session.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all()
    return {row.id: row.full_name for row in rows}


def _line_out(line, *, hide_cost: bool) -> StockRevisionLineOut:
    diff = line.difference_quantity
    if line.counted_quantity is not None and diff is None:
        diff = line_difference(line.counted_quantity, line.expected_quantity)
    value = line_value(diff, line.cost_per_base_unit)
    return StockRevisionLineOut(
        id=line.id,
        stock_item_id=line.stock_item_id,
        stock_item_name=line.stock_item_name,
        base_unit=line.base_unit,
        expected_quantity=line.expected_quantity,
        counted_quantity=line.counted_quantity,
        difference_quantity=diff,
        cost_per_base_unit=0 if hide_cost else line.cost_per_base_unit,
        value=None if hide_cost else value,
        comment=line.comment,
    )


async def _revision_out(session: AsyncSession, revision, *, hide_cost: bool) -> StockRevisionOut:
    names = await _names(session, revision.created_by, revision.posted_by)
    summary = revision_summary(revision, hide_cost=hide_cost)
    return StockRevisionOut(
        id=revision.id,
        shop_id=revision.shop_id,
        status=revision.status,
        comment=revision.comment,
        created_by=revision.created_by,
        created_by_name=names.get(revision.created_by) if revision.created_by else None,
        posted_by=revision.posted_by,
        posted_by_name=names.get(revision.posted_by) if revision.posted_by else None,
        created_at=revision.created_at,
        posted_at=revision.posted_at,
        cancelled_at=revision.cancelled_at,
        lines=[
            _line_out(line, hide_cost=hide_cost)
            for line in sorted(revision.lines, key=lambda row: (row.stock_item_name, row.id))
        ],
        **summary,
    )


@router.get("/shops/{shop_id}/stock-revisions", response_model=list[StockRevisionOut])
async def list_shop_revisions(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    revisions = await list_revisions(session, shop_id)
    return [await _revision_out(session, rev, hide_cost=False) for rev in revisions]


@router.post(
    "/shops/{shop_id}/stock-revisions",
    response_model=StockRevisionOut,
    status_code=201,
)
async def start_revision(
    shop_id: int,
    body: StockRevisionCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    revision = await create_revision(session, shop_id=shop_id, user=user, comment=body.comment)
    await session.commit()
    revision = await load_revision(session, shop_id, revision.id)
    return await _revision_out(session, revision, hide_cost=False)


@router.get("/shops/{shop_id}/stock-revisions/{revision_id}", response_model=StockRevisionOut)
async def get_revision(
    shop_id: int,
    revision_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    revision = await load_revision(session, shop_id, revision_id)
    return await _revision_out(session, revision, hide_cost=False)


@router.get("/shops/{shop_id}/stock-revisions/{revision_id}/export")
async def export_revision(
    shop_id: int,
    revision_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id)
    revision = await load_revision(session, shop_id, revision_id)
    names = await _names(session, revision.created_by, revision.posted_by)
    payload = build_revision_xlsx(
        revision,
        shop_name=shop.name,
        created_by_name=names.get(revision.created_by) if revision.created_by else None,
        posted_by_name=names.get(revision.posted_by) if revision.posted_by else None,
    )
    filename = f"revision-{revision.id}.xlsx"
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/shops/{shop_id}/stock-revisions/{revision_id}", response_model=StockRevisionOut)
async def patch_revision(
    shop_id: int,
    revision_id: int,
    body: StockRevisionUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    revision = await load_revision(session, shop_id, revision_id)
    await save_revision(
        session,
        revision,
        comment=body.comment,
        lines=[row.model_dump() for row in body.lines],
    )
    await session.commit()
    revision = await load_revision(session, shop_id, revision_id)
    return await _revision_out(session, revision, hide_cost=False)


@router.post("/shops/{shop_id}/stock-revisions/{revision_id}/post", response_model=StockRevisionOut)
async def finish_revision(
    shop_id: int,
    revision_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    revision = await load_revision(session, shop_id, revision_id)
    await post_revision(session, revision, user)
    await session.commit()
    revision = await load_revision(session, shop_id, revision_id)
    return await _revision_out(session, revision, hide_cost=False)


@router.post("/shops/{shop_id}/stock-revisions/{revision_id}/cancel", response_model=StockRevisionOut)
async def abandon_revision(
    shop_id: int,
    revision_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    revision = await load_revision(session, shop_id, revision_id)
    await cancel_revision(session, revision, user)
    await session.commit()
    revision = await load_revision(session, shop_id, revision_id)
    return await _revision_out(session, revision, hide_cost=False)
