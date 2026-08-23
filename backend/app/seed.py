"""First-run users. Demo shop only when SEED_DEMO=1 (local)."""

import asyncio
import os

from sqlalchemy import select

from app.config import settings
from app.core.security import hash_secret
from app.database import SessionLocal
from app.models import (
    Category,
    OwnerShop,
    Product,
    ProductIngredient,
    Shop,
    StockItem,
    User,
    UserRole,
)

ADMIN_EMAIL = settings.admin_email
OWNER_EMAIL = "owner@erassyl.local"
BARISTA_EMAIL = "barista@erassyl.local"


async def ensure_admin(session) -> None:
    existing = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
    if existing.scalar_one_or_none():
        return
    password = settings.admin_password or os.environ.get("ADMIN_PASSWORD", "")
    if not password:
        print("No admin yet and ADMIN_PASSWORD is empty — skip")
        return
    session.add(
        User(
            role=UserRole.super_admin,
            full_name="Super Admin",
            email=ADMIN_EMAIL,
            password_hash=hash_secret(password),
        )
    )
    await session.commit()
    print(f"Created admin {ADMIN_EMAIL}")


async def seed_demo(session) -> None:
    existing = await session.execute(select(User).where(User.email == OWNER_EMAIL))
    if existing.scalar_one_or_none():
        print("Demo seed already applied")
        return

    shop = Shop(
        name="Erassyl Coffee",
        address="Helsinki",
        timezone="Europe/Helsinki",
    )
    session.add(shop)
    await session.flush()

    existing_admin = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
    if existing_admin.scalar_one_or_none() is None:
        session.add(
            User(
                role=UserRole.super_admin,
                full_name="Super Admin",
                email=ADMIN_EMAIL,
                password_hash=hash_secret("admin123"),
            )
        )

    owner = User(
        shop_id=shop.id,
        role=UserRole.owner,
        full_name="Erassyl",
        email=OWNER_EMAIL,
        phone="+35800000001",
        password_hash=hash_secret("owner123"),
    )
    barista = User(
        shop_id=shop.id,
        role=UserRole.barista,
        full_name="Amina",
        email=BARISTA_EMAIL,
        phone="+35800000002",
        password_hash=hash_secret("barista123"),
        pin_code=hash_secret("1234"),
    )
    session.add_all([owner, barista])
    await session.flush()
    session.add(OwnerShop(owner_id=owner.id, shop_id=shop.id))

    coffee = Category(shop_id=shop.id, name="Кофе")
    tea = Category(shop_id=shop.id, name="Чай")
    pastry = Category(shop_id=shop.id, name="Выпечка")
    session.add_all([coffee, tea, pastry])
    await session.flush()

    beans = StockItem(
        shop_id=shop.id, name="Зёрна эспрессо",
        base_unit="г", purchase_unit="кг", purchase_to_base="1000",
        quantity=5000, min_quantity=800, cost_per_base_unit="0.028",
    )
    milk = StockItem(
        shop_id=shop.id, name="Молоко",
        base_unit="мл", purchase_unit="пачка", purchase_to_base="1000",
        quantity=20000, min_quantity=3000, cost_per_base_unit="0.0018",
    )
    cups = StockItem(
        shop_id=shop.id, name="Стаканы 300 мл",
        base_unit="шт", purchase_unit="шт", purchase_to_base="1",
        quantity=400, min_quantity=50, cost_per_base_unit="0.12",
    )
    syrup = StockItem(
        shop_id=shop.id, name="Сироп ваниль",
        base_unit="мл", purchase_unit="л", purchase_to_base="1000",
        quantity=2000, min_quantity=200, cost_per_base_unit="0.012",
    )
    croissant = StockItem(
        shop_id=shop.id, name="Круассан",
        base_unit="шт", purchase_unit="шт", purchase_to_base="1",
        quantity=40, min_quantity=8, cost_per_base_unit="1.10",
    )
    tea_bags = StockItem(
        shop_id=shop.id, name="Чай сенча",
        base_unit="шт", purchase_unit="шт", purchase_to_base="1",
        quantity=80, min_quantity=15, cost_per_base_unit="0.18",
    )
    session.add_all([beans, milk, cups, syrup, croissant, tea_bags])
    await session.flush()

    products = [
        ("Эспрессо", coffee.id, "3.20", [(beans, "18"), (cups, "1")]),
        ("Американо", coffee.id, "3.80", [(beans, "18"), (cups, "1")]),
        ("Капучино", coffee.id, "4.50", [(beans, "18"), (milk, "180"), (cups, "1")]),
        ("Латте", coffee.id, "4.80", [(beans, "18"), (milk, "200"), (cups, "1")]),
        ("Раф ваниль", coffee.id, "5.40", [(beans, "18"), (milk, "180"), (syrup, "15"), (cups, "1")]),
        ("Сенча", tea.id, "3.50", [(tea_bags, "1"), (cups, "1")]),
        ("Круассан", pastry.id, "3.20", [(croissant, "1")]),
    ]
    for name, cat_id, price, ings in products:
        product = Product(shop_id=shop.id, category_id=cat_id, name=name, sale_price=price)
        session.add(product)
        await session.flush()
        for item, qty in ings:
            session.add(
                ProductIngredient(product_id=product.id, stock_item_id=item.id, quantity=qty)
            )

    await session.commit()
    print("Seeded local demo shop")


async def seed() -> None:
    async with SessionLocal() as session:
        if settings.seed_demo:
            await seed_demo(session)
            return
        await ensure_admin(session)


if __name__ == "__main__":
    asyncio.run(seed())
