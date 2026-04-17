const raw = document.querySelector('meta[name="api-base"]')?.getAttribute("content");
const base = (raw == null ? "" : String(raw)).replace(/\/$/, "");

function url(p) {
  return (base || "") + p;
}

const $ = (id) => document.getElementById(id);
const mode = $("mode");
const pageSize = $("pageSize");
const meta = $("meta");
const rows = $("rows");
const pager = $("pager");
const scrollWrap = $("scrollWrap");

let page = 1;

/** Cursor mode: accumulated rows + next `after` for API (last response's nextCursor). */
let cursorItems = [];
let cursorNextAfter = null;
let cursorHasMore = false;
let cursorLoading = false;
/** True after any cursor request used `after` (user scrolled or viewport auto-filled). */
let cursorHasPaged = false;

function syncCursorFirstButton() {
  const firstBtn = pager.querySelector("button");
  if (firstBtn) firstBtn.disabled = !cursorHasPaged;
}

function lim() {
  return +pageSize.value || 10;
}

function draw(items) {
  rows.innerHTML = "";
  for (const r of items) {
    const tr = document.createElement("tr");
    for (const k of ["id", "title", "category"]) {
      const td = document.createElement("td");
      td.textContent = r[k];
      tr.appendChild(td);
    }
    rows.appendChild(tr);
  }
}

async function loadOffset() {
  const d = await (await fetch(url(`/api/offset?page=${page}&limit=${lim()}`))).json();
  meta.textContent = `Page ${d.page}/${d.totalPages} · total ${d.total}`;
  draw(d.items);
  pager.innerHTML = "";
  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = d.page <= 1;
  prev.onclick = () => {
    page = d.page - 1;
    loadOffset();
  };
  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = d.page >= d.totalPages;
  next.onclick = () => {
    page = d.page + 1;
    loadOffset();
  };
  pager.append(prev, next);
}

function cursorQuery(after) {
  const q = after == null ? "" : "&after=" + encodeURIComponent(after);
  return url("/api/cursor?limit=" + lim() + q);
}

async function fetchCursorPage(after) {
  const d = await (await fetch(cursorQuery(after))).json();
  return d;
}

async function loadCursor(reset) {
  if (reset) {
    cursorItems = [];
    cursorNextAfter = null;
    cursorHasMore = false;
    cursorHasPaged = false;
  }
  cursorLoading = true;
  try {
    const d = await fetchCursorPage(null);
    cursorItems = d.items.slice();
    cursorHasMore = !!d.hasMore;
    cursorNextAfter = d.nextCursor ?? null;
    meta.textContent = `after=${d.afterId ?? "—"} · next=${d.nextCursor ?? "—"} · loaded ${cursorItems.length}`;
    draw(cursorItems);
    pager.innerHTML = "";
    const first = document.createElement("button");
    first.textContent = "First";
    first.disabled = true;
    first.onclick = () => {
      loadCursor(true);
    };
    pager.append(first);
  } finally {
    cursorLoading = false;
  }
  await maybeFillCursorViewport();
  syncCursorFirstButton();
}

async function loadCursorMore() {
  if (mode.value !== "cursor" || !cursorHasMore || cursorNextAfter == null) return;
  if (cursorLoading) return;
  cursorLoading = true;
  try {
    const d = await fetchCursorPage(cursorNextAfter);
    cursorHasPaged = true;
    cursorItems = cursorItems.concat(d.items);
    cursorHasMore = !!d.hasMore;
    cursorNextAfter = d.nextCursor ?? null;
    meta.textContent = `after=${d.afterId ?? "—"} · next=${d.nextCursor ?? "—"} · loaded ${cursorItems.length}`;
    draw(cursorItems);
  } finally {
    cursorLoading = false;
  }
  await maybeFillCursorViewport();
  syncCursorFirstButton();
}

/** If the table is shorter than the scroll area, keep requesting pages until it scrolls or data ends. */
async function maybeFillCursorViewport() {
  for (;;) {
    if (mode.value !== "cursor" || !cursorHasMore || cursorLoading) break;
    const el = scrollWrap;
    if (el.scrollHeight > el.clientHeight + 1) break;
    await loadCursorMore();
  }
}

function onScrollWrap() {
  if (mode.value !== "cursor") return;
  if (cursorLoading || !cursorHasMore) return;
  const el = scrollWrap;
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight - scrollTop - clientHeight < 80) {
    loadCursorMore();
  }
}

scrollWrap.addEventListener("scroll", onScrollWrap);

function go() {
  if (mode.value === "offset") loadOffset();
  else loadCursor(true);
}

mode.onchange = () => {
  page = 1;
  go();
};
pageSize.onchange = () => {
  page = 1;
  go();
};
$("insertBtn").onclick = async () => {
  await fetch(url("/api/simulate-insert"), { method: "POST" });
  go();
};

go();
