import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  school: text("school").notNull(),
  category: text("category").notNull(),
  meta: text("meta").notNull(),
  tags: text("tags").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    userId: text("user_id").notNull(),
    term: text("term").notNull(),
    instructor: text("instructor").notNull(),
    body: text("body").notNull(),
    rating: integer("rating").notNull(),
    m1: integer("m1").notNull(),
    m2: integer("m2").notNull(),
    m3: integer("m3").notNull(),
    hours: real("hours").notNull(),
    recommend: integer("recommend").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("reviews_user_item").on(t.userId, t.itemId),
    index("reviews_item").on(t.itemId),
  ],
);
