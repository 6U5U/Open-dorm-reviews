export class ValidationError extends Error {}
export function currentTerm(date = new Date()) {
  const month = date.getUTCMonth();
  return `${month < 2 ? "Winter" : month < 5 ? "Spring" : month < 8 ? "Summer" : "Fall"} ${date.getUTCFullYear()}`;
}
export function displayRating(value: number | null) {
  return value === null ? "Not rated" : value.toFixed(1) + " / 5";
}
export type Review = {
  id: string;
  term: string;
  instructor: string;
  body: string;
  rating: number;
  m1: number;
  m2: number;
  m3: number;
  hours: number;
  recommend: boolean;
  own: boolean;
  example: boolean;
  createdAt: string;
};
export type Item = {
  id: string;
  name: string;
  school: string;
  category: string;
  meta: string;
  tags: string[];
  example: boolean;
  reviews: Review[];
};
export function summary(reviews: Review[]) {
  const n = reviews.length;
  const avg = (key: "rating" | "m1" | "m2" | "m3" | "hours") =>
    n ? reviews.reduce((s, r) => s + r[key], 0) / n : null;
  return {
    count: n,
    rating: avg("rating"),
    m1: avg("m1"),
    m2: avg("m2"),
    m3: avg("m3"),
    hours: avg("hours"),
    recommend: n
      ? Math.round((100 * reviews.filter((r) => r.recommend).length) / n)
      : null,
  };
}
export function selectItems(
  items: Item[],
  f: {
    query: string;
    school: string;
    category: string;
    sort: string;
    maxHours: number;
    examples: boolean;
    kind: string;
  },
) {
  const q = f.query.trim().toLowerCase();
  return items
    .filter(
      (x) =>
        (f.examples || !x.example) &&
        (f.school === "all" || x.school === f.school) &&
        (f.category === "all" || x.category === f.category) &&
        [
          x.name,
          x.school,
          x.meta,
          ...x.tags,
          ...x.reviews.map((r) => r.instructor),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q) &&
        (f.kind !== "course" ||
          f.maxHours === 0 ||
          (summary(x.reviews).hours !== null &&
            summary(x.reviews).hours! <= f.maxHours)),
    )
    .sort((a, b) => {
      const aa = summary(a.reviews),
        bb = summary(b.reviews);
      if (f.sort === "name") return a.name.localeCompare(b.name);
      if (f.sort === "workload")
        return (aa.hours ?? Infinity) - (bb.hours ?? Infinity);
      if (f.sort === "reviews") return bb.count - aa.count;
      return (bb.rating ?? -1) - (aa.rating ?? -1) || bb.count - aa.count;
    });
}
function text(v: unknown, label: string, min: number, max: number) {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    throw new ValidationError(`${label} must be ${min}–${max} characters.`);
  return v.trim();
}
function number(
  v: unknown,
  label: string,
  min: number,
  max: number,
  integer = true,
) {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    (integer && !Number.isInteger(v))
  )
    throw new ValidationError(`${label} must be ${min}–${max}.`);
  return v;
}
export function validateReview(v: any, kind: string) {
  if (!v || typeof v !== "object") throw new ValidationError("Enter a review.");
  const term = text(v.term, "Term", 6, 20);
  if (!/^(Spring|Summer|Fall|Winter) 20\d{2}$/.test(term))
    throw new ValidationError("Choose a term and four-digit year.");
  if (Number(term.slice(-4)) > new Date().getUTCFullYear())
    throw new ValidationError("Reviews must describe a current or past term.");
  if (v.confirm !== true)
    throw new ValidationError("Confirm this is your own experience.");
  if (typeof v.recommend !== "boolean")
    throw new ValidationError("Choose whether you would recommend it.");
  return {
    itemId: text(v.itemId, "Listing", 1, 100),
    term,
    instructor:
      kind === "course" ? text(v.instructor, "Instructor", 2, 100) : "",
    body: text(v.body, "Review", 30, 2000),
    rating: number(v.rating, "Overall rating", 1, 5),
    m1: number(v.m1, "First rating", 1, 5),
    m2: number(v.m2, "Second rating", 1, 5),
    m3: number(v.m3, "Third rating", 1, 5),
    hours:
      kind === "course" ? number(v.hours, "Weekly hours", 0, 80, false) : 0,
    recommend: v.recommend,
  };
}
export function validateListing(v: any, categories: string[]) {
  if (!v || typeof v !== "object")
    throw new ValidationError("Enter a listing.");
  const category = text(v.category, "Category", 2, 70);
  if (!categories.includes(category))
    throw new ValidationError("Choose a valid category.");
  const name = text(v.name, "Name", 2, 100).replace(/\s+/g, " "),
    school = text(v.school, "University", 2, 120).replace(/\s+/g, " ");
  if (school.toLowerCase() === "northbridge university")
    throw new ValidationError(
      "Northbridge is reserved for fictional examples. Enter a real university.",
    );
  return {
    name,
    school,
    category,
    meta: text(v.meta, "Details", 2, 160),
    tags: Array.isArray(v.tags)
      ? [
          ...new Set(
            v.tags.slice(0, 5).map((t: unknown) => text(t, "Tag", 2, 32)),
          ),
        ]
      : [],
  };
}
