import test from "node:test";
import assert from "node:assert/strict";
import {
  currentTerm,
  displayRating,
  ValidationError,
  summary,
  selectItems,
  validateReview,
  validateListing,
  type Item,
} from "../lib/domain.ts";
const r = {
  id: "r",
  term: "Fall 2025",
  instructor: "Dr. Lee",
  body: "A useful and thoughtful course with weekly projects.",
  rating: 4,
  m1: 5,
  m2: 3,
  m3: 2,
  hours: 4,
  recommend: true,
  own: false,
  example: false,
  createdAt: "2026-01-01",
};
const input = { ...r, itemId: "i", confirm: true };
const items: Item[] = [
  {
    id: "i",
    name: "Film",
    school: "Test U",
    category: "Arts",
    meta: "FILM 100",
    tags: ["Projects"],
    example: false,
    reviews: [r],
  },
  {
    id: "j",
    name: "Space",
    school: "Demo U",
    category: "Science",
    meta: "ASTR",
    tags: [],
    example: true,
    reviews: [{ ...r, hours: 8, rating: 5 }],
  },
  {
    id: "k",
    name: "Unrated",
    school: "Test U",
    category: "Arts",
    meta: "NEW",
    tags: [],
    example: false,
    reviews: [],
  },
];
const f = {
  query: "",
  school: "all",
  category: "all",
  sort: "rating",
  maxHours: 0,
  examples: true,
  kind: "course",
};
test("unrated listings have null averages, not zero or NaN", () =>
  assert.deepEqual(summary([]), {
    count: 0,
    rating: null,
    m1: null,
    m2: null,
    m3: null,
    hours: null,
    recommend: null,
  }));
test("averages weight each review equally and compute recommendation percent", () => {
  const s = summary([r, { ...r, rating: 2, hours: 6, recommend: false }]);
  assert.equal(s.rating, 3);
  assert.equal(s.hours, 5);
  assert.equal(s.recommend, 50);
});
test("query is case insensitive and searches metadata and tags", () =>
  assert.deepEqual(
    selectItems(items, { ...f, query: " projects " }).map((x) => x.id),
    ["i"],
  ));
test("filters combine university, category, workload, and demo visibility", () =>
  assert.deepEqual(
    selectItems(items, {
      ...f,
      school: "Test U",
      category: "Arts",
      maxHours: 4,
      examples: false,
    }).map((x) => x.id),
    ["i"],
  ));
test("unknown workload does not pass an explicit workload limit", () =>
  assert.equal(
    selectItems(items, { ...f, maxHours: 4 }).some((x) => x.id === "k"),
    false,
  ));
test("unrated listings sort after rated ones", () =>
  assert.deepEqual(
    selectItems(items, f).map((x) => x.id),
    ["j", "i", "k"],
  ));
test("workload sorting puts unknown hours last", () =>
  assert.deepEqual(
    selectItems(items, { ...f, sort: "workload" }).map((x) => x.id),
    ["i", "j", "k"],
  ));
test("course review requires instructor and valid hours", () => {
  assert.equal(validateReview(input, "course").hours, 4);
  for (const change of [
    { instructor: "" },
    { hours: null },
    { hours: -1 },
    { hours: Infinity },
    { hours: 81 },
  ])
    assert.throws(() => validateReview({ ...input, ...change }, "course"));
});
test("dorm review never stores irrelevant course fields", () => {
  const v = validateReview(input, "dorm");
  assert.equal(v.instructor, "");
  assert.equal(v.hours, 0);
});
test("all ratings must be integer 1–5", () => {
  for (const key of ["rating", "m1", "m2", "m3"])
    for (const value of [0, 6, 2.5, "5", null, NaN])
      assert.throws(() => validateReview({ ...input, [key]: value }, "course"));
});
test("rejects missing confirmation, empty or oversized review, invalid term and future year", () => {
  for (const change of [
    { confirm: false },
    { body: "short" },
    { body: "x".repeat(2001) },
    { term: "yesterday" },
    { term: "Fall 2099" },
    { recommend: "yes" },
  ])
    assert.throws(() => validateReview({ ...input, ...change }, "course"));
});
test("listing normalizes whitespace and validates real school/category", () => {
  assert.equal(
    validateListing(
      {
        name: " Test ",
        school: " University ",
        category: "Arts",
        meta: "Code",
        tags: [" Nice "],
      },
      ["Arts"],
    ).name,
    "Test",
  );
  assert.throws(() =>
    validateListing(
      {
        name: "Test",
        school: "Northbridge University",
        category: "Arts",
        meta: "Code",
      },
      ["Arts"],
    ),
  );
  assert.throws(() =>
    validateListing(
      { name: "Test", school: "Test U", category: "Fake", meta: "Code" },
      ["Arts"],
    ),
  );
});

test("search finds instructors from submitted reviews, not just catalog metadata", () => {
  assert.equal(selectItems(items, { ...f, query: "dr. lee" }).length, 2);
  assert.equal(
    selectItems(items, { ...f, query: "unknown instructor" }).length,
    0,
  );
});
test("listing normalization prevents whitespace duplicates and repeated feature tags", () => {
  const v = validateListing(
    {
      name: " Maple   Hall ",
      school: " Sample   University ",
      category: "Arts",
      meta: "North campus",
      tags: ["Kitchen", "Kitchen"],
    },
    ["Arts"],
  );
  assert.equal(v.name, "Maple Hall");
  assert.equal(v.school, "Sample University");
  assert.deepEqual(v.tags, ["Kitchen"]);
});

test("term defaults advance with the calendar", () => {
  assert.equal(currentTerm(new Date("2026-01-10T00:00:00Z")), "Winter 2026");
  assert.equal(currentTerm(new Date("2026-04-10T00:00:00Z")), "Spring 2026");
  assert.equal(currentTerm(new Date("2026-07-10T00:00:00Z")), "Summer 2026");
  assert.equal(currentTerm(new Date("2027-10-10T00:00:00Z")), "Fall 2027");
});
test("missing scores are explicitly unrated", () => {
  assert.equal(displayRating(null), "Not rated");
  assert.equal(displayRating(4.25), "4.3 / 5");
});
test("user validation errors have a distinct type from internal failures", () =>
  assert.throws(
    () => validateReview({ ...input, rating: 0 }, "course"),
    ValidationError,
  ));
