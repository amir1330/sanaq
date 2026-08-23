"""Disable demo accounts and set admin password from stdin. Never prints the password."""

import asyncio
import sys

from sqlalchemy import select

from app.core.security import hash_secret
from app.database import SessionLocal
from app.models import Lead, Shop, User, UserRole

DEMO_EMAILS = ("owner@erassyl.local", "barista@erassyl.local")
ADMIN_EMAIL = "admin@coffeeos.local"


async def run(password: str) -> None:
    if not password:
        raise SystemExit("empty password")
    async with SessionLocal() as session:
        admin = (
            await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        ).scalar_one_or_none()
        if admin is None:
            session.add(
                User(
                    role=UserRole.super_admin,
                    full_name="Super Admin",
                    email=ADMIN_EMAIL,
                    password_hash=hash_secret(password),
                    is_active=True,
                )
            )
        else:
            admin.password_hash = hash_secret(password)
            admin.is_active = True

        result = await session.execute(select(User).where(User.email.in_(DEMO_EMAILS)))
        for user in result.scalars().all():
            user.is_active = False

        shops = await session.execute(select(Shop).where(Shop.name == "Erassyl Coffee"))
        for shop in shops.scalars().all():
            shop.is_active = False

        leads = (await session.execute(select(Lead))).scalars().all()
        for lead in leads:
            await session.delete(lead)

        await session.commit()
        print("prod lockdown: admin updated, demo users/shop off, leads cleared")


if __name__ == "__main__":
    asyncio.run(run(sys.stdin.read().rstrip("\n")))
