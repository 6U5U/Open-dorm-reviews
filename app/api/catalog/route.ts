import { database } from "@/lib/database";
import config from "@/lib/config.json";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ValidationError, validateListing } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getChatGPTUser();
    const db = database();
    const [listings, reviews] = await db.batch([
      db.prepare(
        "SELECT id,name,school,category,meta,tags FROM listings ORDER BY created_at DESC",
      ),
      db.prepare("SELECT * FROM reviews ORDER BY created_at DESC"),
    ]);
    const rs = (reviews.results as any[]).map((r) => ({
      id: r.id,
      itemId: r.item_id,
      term: r.term,
      instructor: r.instructor,
      body: r.body,
      rating: r.rating,
      m1: r.m1,
      m2: r.m2,
      m3: r.m3,
      hours: r.hours,
      recommend: !!r.recommend,
      own: r.user_id === user?.userId,
      example: r.item_id.startsWith("example-"),
      createdAt: r.created_at,
    }));
    const all = [
      ...config.items,
      ...(listings.results as any[]).map((x) => ({
        ...x,
        tags: JSON.parse(x.tags),
        example: false,
        reviews: [],
      })),
    ];
    return Response.json(
      {
        signedIn: !!user,
        items: all.map((x) => ({
          ...x,
          reviews: [
            ...rs.filter((r) => r.itemId === x.id).map(({ itemId, ...r }) => r),
            ...x.reviews,
          ],
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("catalog unavailable", e);
    return Response.json(
      { error: "Reviews could not be loaded. Please try again." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to add a listing." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "This request must come from this site." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 4000) throw new ValidationError("Listing is too long.");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid listing data.");
    }
    const v = validateListing(data, config.categories);
    const identity = v.school.toLowerCase() + "|" + v.name.toLowerCase();
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(identity),
    );
    const id = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const db = database();
    const count = await db
      .prepare(
        "SELECT COUNT(*) as n FROM listings WHERE created_by = ? AND created_at > ?",
      )
      .bind(user.userId, new Date(Date.now() - 3600000).toISOString())
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 20)
      return Response.json(
        {
          error:
            "You have added several listings. Please try again in an hour.",
        },
        { status: 429 },
      );
    const result = await db
      .prepare(
        "INSERT INTO listings (id,name,school,category,meta,tags,created_by,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(
        id,
        v.name,
        v.school,
        v.category,
        v.meta,
        JSON.stringify(v.tags),
        user.userId,
        new Date().toISOString(),
      )
      .run();
    return Response.json(
      { id, created: result.meta.changes > 0 },
      { status: result.meta.changes > 0 ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof ValidationError)
      return Response.json({ error: e.message }, { status: 400 });
    console.error("listing save failed", e);
    return Response.json(
      {
        error:
          "Could not save the listing. Your input is still here; please retry.",
      },
      { status: 503 },
    );
  }
}
