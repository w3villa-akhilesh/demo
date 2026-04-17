import math
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

insert_n = 0
products: List[dict] = []


def _init_products() -> None:
    global products
    products = []
    for i in range(1, 88):
        products.append(
            {
                "id": i,
                "title": f"Item {str(i).zfill(3)}",
                "category": ["Books", "Electronics", "Home"][i % 3],
            }
        )


_init_products()


def insert_first() -> None:
    global insert_n
    insert_n += 1
    new_id = max(p["id"] for p in products) + 1 if products else 1
    products.append(
        {"id": new_id, "title": f"NEW {insert_n}", "category": "New"}
    )
    products.sort(key=lambda p: p["id"])


def rows() -> List[dict]:
    return sorted(products, key=lambda p: p["id"])


def _parse_after(raw: Optional[str]) -> Optional[int]:
    if raw is None or raw == "" or raw == "null":
        return None
    try:
        return int(str(raw), 10)
    except ValueError:
        return None


@app.get("/api/offset")
def api_offset(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50)):
    limit = min(50, max(1, limit))
    list_r = rows()
    offset = (page - 1) * limit
    total = len(list_r)
    total_pages = math.ceil(total / limit) if limit else 0
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": total_pages,
        "items": list_r[offset : offset + limit],
    }


@app.get("/api/cursor")
def api_cursor(
    limit: int = Query(10, ge=1, le=50),
    after: Optional[str] = Query(None),
):
    limit = min(50, max(1, limit))
    after_id = _parse_after(after)
    list_r = rows()
    if after_id is not None:
        list_r = [p for p in list_r if p["id"] > after_id]
    items = list_r[:limit]
    last = items[-1] if items else None
    return {
        "afterId": after_id,
        "items": items,
        "nextCursor": last["id"] if last else None,
        "hasMore": len(list_r) > limit,
    }


@app.post("/api/simulate-insert")
def api_simulate_insert():
    insert_first()
    return {"ok": True, "total": len(rows())}


app.mount(
    "/",
    StaticFiles(directory=str(Path(__file__).resolve().parent / "public"), html=True),
    name="static",
)
