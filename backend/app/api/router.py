from fastapi import APIRouter

from app.api.v1 import admin, auth, catalog, expenses, leads, reports, sales, shifts, shops, staff, stock

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(leads.router)
api_router.include_router(shops.router)
api_router.include_router(catalog.router)
api_router.include_router(stock.router)
api_router.include_router(staff.router)
api_router.include_router(shifts.router)
api_router.include_router(sales.router)
api_router.include_router(expenses.router)
api_router.include_router(reports.router)
