import { database } from "@/lib/database";
import config from "@/lib/config.json";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ValidationError, validateReview } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your review." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "This request must come from this site." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 8000) throw new ValidationError("Review is too long.");
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid review data.");
    }
    const v = validateReview(input, config.kind);
    const db = database();
    const exists =
      config.items.some((x) => x.id === v.itemId) ||
      (await db
        .prepare("SELECT id FROM listings WHERE id = ?")
        .bind(v.itemId)
        .first());
    if (!exists)
      return Response.json(
        { error: "This listing no longer exists." },
        { status: 404 },
      );
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO reviews (id,item_id,user_id,term,instructor,body,rating,m1,m2,m3,hours,recommend,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET term=excluded.term,instructor=excluded.instructor,body=excluded.body,rating=excluded.rating,m1=excluded.m1,m2=excluded.m2,m3=excluded.m3,hours=excluded.hours,recommend=excluded.recommend,created_at=excluded.created_at",
      )
      .bind(
        id,
        v.itemId,
        user.userId,
        v.term,
        v.instructor,
        v.body,
        v.rating,
        v.m1,
        v.m2,
        v.m3,
        v.hours,
        v.recommend ? 1 : 0,
        new Date().toISOString(),
      )
      .run();
    return Response.json({ saved: true });
  } catch (e) {
    if (e instanceof ValidationError)
      return Response.json({ error: e.message }, { status: 400 });
    console.error("review save failed", e);
    return Response.json(
      {
        error:
          "Could not save your review. Your input is still here; please retry.",
      },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to remove your review." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "This request must come from this site." },
      { status: 403 },
    );
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 100)
    return Response.json({ error: "Choose a valid review." }, { status: 400 });
  try {
    const r = await database()
      .prepare("DELETE FROM reviews WHERE id = ? AND user_id = ?")
      .bind(id, user.userId)
      .run();
    if (!r.meta.changes)
      return Response.json(
        { error: "Review not found or not yours." },
        { status: 404 },
      );
    return Response.json({ deleted: true });
  } catch (e) {
    console.error("review delete failed", e);
    return Response.json(
      { error: "Could not remove this review. Please retry." },
      { status: 503 },
    );
  }
}
