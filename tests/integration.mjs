import assert from "node:assert/strict";
const base = process.env.TEST_ORIGIN;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Use TEST_ORIGIN pointing to the local test server only.");
const kind = process.env.TEST_KIND || "dorm";
let checks = 0;
const check = (v, message) => {
  assert.ok(v, message);
  checks++;
};
async function call(path, method = "GET", body, auth = false, origin = base) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(auth ? { cookie } : {}),
      ...(method !== "GET"
        ? { "Content-Type": "application/json", Origin: origin }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: res.status, data };
}
const login = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
check(cookie.length > 0, "Local sign-in cookie is available");
const catalog = await call("/api/catalog");
check(catalog.status === 200, "Catalog loads");
check(
  catalog.data.items.filter((x) => x.example).length === 6,
  "Six clearly labeled example listings",
);
check(catalog.data.signedIn === false, "Anonymous identity is not signed in");
const signed = await call("/api/catalog", "GET", undefined, true);
check(signed.data.signedIn === true, "Local sign-in is recognized");
const review = {
  itemId: "example-1",
  term: "Fall 2025",
  instructor: "Test Instructor",
  body: "Integration test: a thoughtful course and a quiet place to study.",
  rating: 4,
  m1: 3,
  m2: 4,
  m3: 5,
  hours: 4.5,
  recommend: true,
  confirm: true,
};
check(
  (await call("/api/reviews", "POST", review)).status === 401,
  "Anonymous review rejected",
);
check(
  (await call("/api/reviews", "POST", review, true, "https://foreign.example"))
    .status === 403,
  "Cross-origin write rejected",
);
check(
  (await call("/api/reviews", "POST", { ...review, rating: 6 }, true))
    .status === 400,
  "Invalid rating rejected on server",
);
check(
  (await call("/api/reviews", "POST", { ...review, itemId: "missing" }, true))
    .status === 404,
  "Unknown listing rejected",
);
check(
  (await call("/api/reviews", "POST", review, true)).status === 200,
  "Review saved",
);
let result = await call("/api/catalog", "GET", undefined, true);
let rows = result.data.items.find((x) => x.id === "example-1").reviews;
let own = rows.find((r) => r.own);
check(!!own, "Saved review survives a fresh request");
check(own.example === true, "Reviews on demo listings remain labeled demo");
check(
  own.hours === (kind === "dorm" ? 0 : 4.5),
  "Workload follows app semantics",
);
check(!("user_id" in own) && !("userId" in own), "Identity is not exposed");
check(
  (
    await call(
      "/api/reviews",
      "POST",
      {
        ...review,
        rating: 2,
        body: "Updated integration review with enough detail to pass validation.",
      },
      true,
    )
  ).status === 200,
  "Review edited",
);
result = await call("/api/catalog", "GET", undefined, true);
rows = result.data.items.find((x) => x.id === "example-1").reviews;
check(
  rows.filter((r) => r.own).length === 1,
  "Update does not create duplicate review",
);
check(rows.find((r) => r.own).rating === 2, "Updated rating persisted");
check(
  (await call("/api/reviews?id=example-review-0", "DELETE", undefined, true))
    .status === 404,
  "Cannot delete a review not owned by current user",
);
check(
  (await call("/api/reviews?id=" + own.id, "DELETE", undefined, true))
    .status === 200,
  "Own review deleted",
);
result = await call("/api/catalog", "GET", undefined, true);
check(
  !result.data.items
    .find((x) => x.id === "example-1")
    .reviews.some((r) => r.own),
  "Deletion persists",
);
const listing = {
  name: "Integration " + kind + " listing",
  school: "Integration Test University",
  category: kind === "dorm" ? "Suites" : "Arts & humanities",
  meta: "Test-only listing",
  tags: ["Test"],
};
check(
  (await call("/api/catalog", "POST", listing)).status === 401,
  "Anonymous listing rejected",
);
const created = await call("/api/catalog", "POST", listing, true);
check([200, 201].includes(created.status), "Real listing created or reused");
const duplicate = await call(
  "/api/catalog",
  "POST",
  { ...listing, name: listing.name.toUpperCase() },
  true,
);
check(
  duplicate.data.id === created.data.id &&
    duplicate.status === 200 &&
    duplicate.data.created === false,
  "Case-insensitive duplicate is deduplicated",
);
check(
  (
    await call(
      "/api/reviews",
      "POST",
      { ...review, itemId: created.data.id },
      true,
    )
  ).status === 200,
  "Review saved to new listing",
);
result = await call("/api/catalog", "GET", undefined, true);
const real = result.data.items.find((x) => x.id === created.data.id);
check(
  real.example === false && real.reviews[0].example === false,
  "Real listing stays separate from demo",
);
await call("/api/reviews?id=" + real.reviews[0].id, "DELETE", undefined, true);
console.log(
  JSON.stringify({
    passed: checks,
    app: kind,
    origin: base,
    localTestListingId: created.data.id,
  }),
);
