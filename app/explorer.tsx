"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  ArrowUpRight,
  Plus,
  SlidersHorizontal,
  Check,
  House,
  BookOpen,
  Clock,
  Star,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import c from "@/lib/config.json";
import {
  summary,
  selectItems,
  currentTerm,
  displayRating,
  validateReview,
  type Item,
  type Review,
} from "@/lib/domain";
const dorm = c.kind === "dorm";
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(1));
const emptyReview = {
  term: currentTerm(),
  instructor: "",
  body: "",
  rating: 0,
  m1: 0,
  m2: 0,
  m3: 0,
  hours: "",
  recommend: "",
  confirm: false,
};
export default function Explorer({
  signedIn,
  signInHref,
}: {
  signedIn: boolean;
  signInHref: string;
}) {
  const drafts = useRef(new Map<string, typeof emptyReview>());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [items, setItems] = useState<Item[]>(c.items as Item[]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState(""),
    [school, setSchool] = useState("all"),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("rating"),
    [maxHours, setMaxHours] = useState("0"),
    [examples, setExamples] = useState(true),
    [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [reviewItem, setReviewItem] = useState<string | null>(null),
    [review, setReview] = useState(emptyReview),
    [formError, setFormError] = useState(""),
    [saving, setSaving] = useState(false);
  const [compared, setCompared] = useState<string[]>([]),
    [compareOpen, setCompareOpen] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false),
    [newItem, setNewItem] = useState({
      name: "",
      school: "",
      category: c.categories[0],
      meta: "",
      tags: "",
    }),
    [guidelines, setGuidelines] = useState(false),
    [term, setTerm] = useState("all"),
    [instructor, setInstructor] = useState("all");
  async function refresh() {
    setLoadError("");
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        items: Item[];
        id: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "The request could not be completed. Please retry.");
      if (!Array.isArray(data.items))
        throw new Error("Reviews could not be loaded. Please retry.");
      setItems(data.items);
      setHasLoaded(true);
      return data.items as Item[];
    } catch (e) {
      setLoadError(
        e instanceof Error &&
          !(e instanceof TypeError) &&
          !(e instanceof SyntaxError)
          ? e.message
          : "Reviews could not be loaded.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh().then((loaded) => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("listing");
      if (!id || !loaded) return;
      if (!loaded.some((x) => x.id === id)) {
        toast.error("That listing could not be found.");
        return;
      }
      if (params.get("write") === "1" && signedIn) startReview(id, loaded);
      else setSelected(id);
    });
    const onBack = () => {
      setSelected(new URLSearchParams(window.location.search).get("listing"));
      setTerm("all");
      setInstructor("all");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (reviewItem) drafts.current.set(reviewItem, review);
  }, [reviewItem, review]);
  useEffect(() => {
    if (formError) document.getElementById("form-error")?.focus();
  }, [formError]);
  const schools = Array.from(
    new Set(items.filter((x) => examples || !x.example).map((x) => x.school)),
  ).sort();
  const filtered = useMemo(
    () =>
      selectItems(items, {
        query,
        school,
        category,
        sort,
        maxHours: Number(maxHours),
        examples,
        kind: c.kind,
      }).filter((x) => !mine || x.reviews.some((r) => r.own)),
    [items, query, school, category, sort, maxHours, examples, mine],
  );
  const current = items.find((x) => x.id === selected),
    editing = items.find((x) => x.id === reviewItem);
  const detailReviews =
    current?.reviews.filter(
      (r) =>
        (term === "all" || r.term === term) &&
        (instructor === "all" || r.instructor === instructor),
    ) ?? [];
  const ds = summary(detailReviews);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "search_student_reviews",
            description:
              "Filter the visible " +
              c.plural +
              " by a text query. Returns matching listing names.",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute(input: any) {
              if (
                !input ||
                typeof input.query !== "string" ||
                input.query.length > 200
              )
                throw new Error("Provide a query of at most 200 characters.");
              setQuery(input.query);
              setSchool("all");
              setCategory("all");
              setMaxHours("0");
              setMine(false);
              return selectItems(items, {
                query: input.query,
                school: "all",
                category: "all",
                sort,
                maxHours: 0,
                examples,
                kind: c.kind,
              }).map((x) => ({ id: x.id, name: x.name, example: x.example }));
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [items, sort, examples]);
  function openItem(id: string) {
    setTerm("all");
    setInstructor("all");
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set("listing", id);
    url.searchParams.delete("write");
    if (url.href !== window.location.href)
      window.history.pushState({}, "", url);
  }
  function closeItem() {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("listing");
    url.searchParams.delete("write");
    window.history.replaceState({}, "", url);
  }
  async function shareItem(id: string) {
    const url = new URL(window.location.origin);
    url.searchParams.set("listing", id);
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success("Listing link copied. Current site access still applies.");
    } catch {
      toast.error("Copy the link from your browser’s address bar.");
    }
  }
  function startReview(id: string, available = items) {
    if (!signedIn) {
      const auth = new URL(signInHref, window.location.origin);
      auth.searchParams.set(
        "return_to",
        "/?listing=" + encodeURIComponent(id) + "&write=1",
      );
      window.location.assign(auth.href);
      return;
    }
    setPickerOpen(false);
    const location = new URL(window.location.href);
    location.searchParams.set("listing", id);
    location.searchParams.delete("write");
    window.history.replaceState({}, "", location);
    const own = available.find((x) => x.id === id)?.reviews.find((r) => r.own);
    setReview(
      drafts.current.get(id) ??
        (own
          ? {
              term: own.term,
              instructor: own.instructor,
              body: own.body,
              rating: own.rating,
              m1: own.m1,
              m2: own.m2,
              m3: own.m3,
              hours: String(own.hours),
              recommend: own.recommend ? "yes" : "no",
              confirm: false,
            }
          : { ...emptyReview, term: currentTerm() }),
    );
    setFormError("");
    setSelected(null);
    setReviewItem(id);
  }
  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewItem) return;
    setSaving(true);
    setFormError("");
    try {
      validateReview(
        {
          ...review,
          itemId: reviewItem,
          hours: review.hours === "" ? null : Number(review.hours),
          recommend:
            review.recommend === "yes"
              ? true
              : review.recommend === "no"
                ? false
                : null,
        },
        c.kind,
      );
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...review,
          itemId: reviewItem,
          hours: review.hours === "" ? null : Number(review.hours),
          recommend:
            review.recommend === "yes"
              ? true
              : review.recommend === "no"
                ? false
                : null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        items: Item[];
        id: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "The request could not be completed. Please retry.");
      const id = reviewItem;
      drafts.current.delete(id);
      setReviewItem(null);
      toast.success("Your review is saved.");
      await refresh();
      openItem(id);
    } catch (e) {
      setFormError(
        e instanceof Error &&
          !(e instanceof TypeError) &&
          !(e instanceof SyntaxError)
          ? e.message
          : "Could not save your review. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function addListing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          tags: newItem.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        items: Item[];
        id: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "The request could not be completed. Please retry.");
      setAddOpen(false);
      setNewItem({
        name: "",
        school: "",
        category: c.categories[0],
        meta: "",
        tags: "",
      });
      reset();
      toast.success(
        data.created === false
          ? "This listing already exists. Here it is."
          : "Listing saved. Add the first review to help another student.",
      );
      await refresh();
      openItem(data.id);
    } catch (e) {
      setFormError(
        e instanceof Error &&
          !(e instanceof TypeError) &&
          !(e instanceof SyntaxError)
          ? e.message
          : "Could not add this listing.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeReview() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res = await fetch(
        "/api/reviews?id=" + encodeURIComponent(deleteId),
        { method: "DELETE" },
      );
      const data = (await res.json()) as {
        error?: string;
        items: Item[];
        id: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "The request could not be completed. Please retry.");
      setDeleteId(null);
      toast.success("Your review was removed.");
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error &&
          !(e instanceof TypeError) &&
          !(e instanceof SyntaxError)
          ? e.message
          : "Could not remove your review.",
      );
    } finally {
      setSaving(false);
    }
  }
  function toggleCompare(id: string) {
    setCompared((old) => {
      if (old.includes(id)) return old.filter((x) => x !== id);
      if (old.length === 3) {
        toast("Compare up to three at a time. Remove one to add another.");
        return old;
      }
      return [...old, id];
    });
  }
  function reset() {
    setQuery("");
    setSchool("all");
    setCategory("all");
    setMaxHours("0");
    setMine(false);
  }
  return (
    <div className={c.kind}>
      <Toaster richColors position="bottom-right" />
      <a className="skip" href="#results">
        Skip to results
      </a>
      <header className="top">
        <a href="/" className="brand">
          {c.brand}
          <span aria-hidden="true">{dorm ? "✳" : "↗"}</span>
        </a>
        <div className="topnav">
          <button
            className={"textbutton my-reviews " + (mine ? "active" : "")}
            aria-pressed={mine}
            onClick={() => {
              reset();
              setExamples(true);
              setMine(!mine);
              document
                .getElementById("results")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            My reviews
          </button>
          <button
            className="secondary-nav textbutton"
            onClick={() => setGuidelines(true)}
          >
            How it works
          </button>
          {signedIn ? (
            <button
              className="primary"
              onClick={() => {
                setPickerQuery("");
                setPickerOpen(true);
              }}
            >
              Write a review <Plus size={16} />
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                setPickerQuery("");
                setPickerOpen(true);
              }}
            >
              Write a review <Plus size={16} />
            </button>
          )}
        </div>
      </header>
      <main className="wrap">
        <section className={"intro " + (dorm ? "with-image" : "")}>
          <div>
            <span className="eyebrow">
              {dorm ? "STUDENT DORM REVIEWS" : "STUDENT COURSE REVIEWS"}
            </span>
            <h1>{c.title}</h1>
            <p>{c.subtitle}</p>
            {!dorm && (
              <div className="intro-chips">
                <span>
                  <Clock size={15} /> Real workload
                </span>
                <span>
                  <Star size={15} /> Worth taking
                </span>
                <span>
                  <BookOpen size={15} /> By term & instructor
                </span>
              </div>
            )}
          </div>
          {dorm && (
            <figure className="room-image">
              <img
                src="/dorm-room.webp"
                alt="Illustration of a bright dorm room with green bedding and a desk by the window"
              />
              <figcaption>Illustrative room · AI-generated</figcaption>
            </figure>
          )}
        </section>
        <section className="browse" aria-label={"Browse " + c.plural}>
          <div className="browse-heading">
            <h2>
              {mine
                ? "Your reviews"
                : dorm
                  ? "Find your home base"
                  : "Find your next elective"}
            </h2>
            <button
              className="textbutton"
              onClick={() => {
                if (!signedIn) {
                  window.location.assign(signInHref);
                  return;
                }
                setFormError("");
                setAddOpen(true);
              }}
            >
              <Plus size={16} /> Add a {c.noun}
            </button>
          </div>
          <div className="filters">
            <label className="search">
              <Search size={19} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  dorm
                    ? "Search dorms, amenities, universities…"
                    : "Search courses, instructors, universities…"
                }
                aria-label={"Search " + c.plural}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              )}
            </label>
            <Choice
              label="University"
              value={school}
              onChange={setSchool}
              options={[
                { value: "all", label: "All universities" },
                ...opts(schools),
              ]}
            />
            <Choice
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                {
                  value: "all",
                  label: dorm ? "All room styles" : "All subjects",
                },
                ...opts(c.categories),
              ]}
            />
            {!dorm && (
              <Choice
                label="Weekly workload"
                value={maxHours}
                onChange={setMaxHours}
                options={[
                  { value: "0", label: "Any workload" },
                  { value: "4", label: "Up to 4 hrs / week" },
                  { value: "6", label: "Up to 6 hrs / week" },
                  { value: "10", label: "Up to 10 hrs / week" },
                ]}
              />
            )}
          </div>
          <div className="quick-filters" aria-label="Popular searches">
            <span>{dorm ? "What matters to you?" : "Looking for…"}</span>
            {(dorm
              ? ["Quiet floors", "Air conditioning", "Kitchen", "Near classes"]
              : ["No final exam", "Beginner-friendly", "Projects", "Writing"]
            ).map((tag) => (
              <button
                key={tag}
                aria-pressed={query === tag}
                className={query === tag ? "selected" : ""}
                onClick={() => setQuery(query === tag ? "" : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="results-heading">
            <div className="result-count" role="status">
              {loading
                ? "Loading reviews…"
                : filtered.length +
                  " " +
                  (filtered.length === 1 ? c.noun : c.plural)}
              {(query ||
                school !== "all" ||
                category !== "all" ||
                maxHours !== "0") && (
                <button className="textbutton" onClick={reset}>
                  Clear filters
                </button>
              )}
              {mine && (
                <button className="textbutton" onClick={() => setMine(false)}>
                  Show all
                </button>
              )}
            </div>
            <div className="result-options">
              <label className="checklabel">
                <Checkbox
                  checked={examples}
                  onCheckedChange={(v) => {
                    setExamples(v === true);
                    setSchool("all");
                  }}
                />{" "}
                Include demo campus
              </label>
              <Choice
                label="Sort results"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "rating", label: "Highest rated" },
                  { value: "reviews", label: "Most reviewed" },
                  { value: "name", label: "Name A–Z" },
                  ...(!dorm
                    ? [{ value: "workload", label: "Lowest workload" }]
                    : []),
                ]}
              />
            </div>
          </div>
        </section>
        {loadError && (
          <div className="error" role="alert">
            {loadError}
            {hasLoaded
              ? " Showing the last loaded results."
              : " Only fictional examples are available while the connection recovers."}{" "}
            <button
              onClick={() => {
                setLoading(true);
                void refresh();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {examples && (
          <div className="demo-note">
            <span>DEMO CAMPUS</span> Northbridge University and its sample
            reviews are fictional. Add your university to start a real catalog.
          </div>
        )}
        <section id="results" aria-label="Results" className="cards">
          {loading ? (
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))
          ) : filtered.length ? (
            filtered.map((x) => {
              const s = summary(x.reviews);
              return (
                <article key={x.id} className="item">
                  <div className="item-top">
                    <span className="eyebrow">{x.category}</span>
                    <span className={"score " + (!s.count ? "unrated" : "")}>
                      {s.count ? (
                        <>
                          <Star size={13} fill="currentColor" />
                          {fmt(s.rating)}
                        </>
                      ) : (
                        "New"
                      )}
                    </span>
                  </div>
                  <h2>
                    <button onClick={() => openItem(x.id)}>{x.name}</button>
                  </h2>
                  <p className="school-line">
                    {x.school}
                    {x.example ? " · Demo" : ""}
                  </p>
                  <p className="meta">{x.meta}</p>
                  <div className="tags">
                    {x.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="metrics">
                    {(dorm
                      ? c.metrics.map((label, i) => ({
                          label,
                          value: fmt(s[("m" + (i + 1)) as "m1" | "m2" | "m3"]),
                        }))
                      : [
                          {
                            label: "Weekly work",
                            value:
                              s.hours === null ? "—" : fmt(s.hours) + " hrs",
                          },
                          { label: "Interest", value: displayRating(s.m1) },
                          {
                            label: "Take again",
                            value:
                              s.recommend === null ? "—" : s.recommend + "%",
                          },
                        ]
                    ).map((m) => (
                      <div key={m.label}>
                        <small>{m.label}</small>
                        <strong>{m.value}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="rating-context">
                    {s.count === 0
                      ? "Be the first to share your experience."
                      : s.count === 1
                        ? "One perspective. Read the full review."
                        : "Based on " + s.count + " student experiences."}
                  </p>
                  <div className="card-bottom">
                    <button
                      className="textbutton"
                      onClick={() => openItem(x.id)}
                    >
                      {s.count
                        ? "Read " +
                          s.count +
                          (s.count === 1 ? " review" : " reviews")
                        : "View details"}{" "}
                      <ArrowUpRight size={15} />
                    </button>
                    <label className="checklabel">
                      <Checkbox
                        checked={compared.includes(x.id)}
                        onCheckedChange={() => toggleCompare(x.id)}
                      />
                      Compare
                    </label>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty">
              <div className="empty-icon">
                {dorm ? <House /> : <BookOpen />}
              </div>
              <h3>{mine ? "No reviews yet" : "No " + c.plural + " found"}</h3>
              <p>
                {mine
                  ? "Choose a listing and share your experience."
                  : "Try broader filters, include the demo campus, or add the first listing for your university."}
              </p>
              <button
                className="primary"
                onClick={
                  mine
                    ? () => {
                        setPickerQuery("");
                        setPickerOpen(true);
                      }
                    : reset
                }
              >
                {mine ? "Write your first review" : "Reset filters"}
              </button>
              {!mine && (
                <button
                  className="textbutton"
                  onClick={() => {
                    if (!signedIn) {
                      window.location.assign(signInHref);
                      return;
                    }
                    setFormError("");
                    setAddOpen(true);
                  }}
                >
                  Add a {c.noun}
                </button>
              )}
              {!examples && (
                <button
                  className="textbutton"
                  onClick={() => setExamples(true)}
                >
                  Explore demo campus
                </button>
              )}
            </div>
          )}
        </section>
        <footer>
          <div>
            <a className="brand" href="/">
              {c.brand}
            </a>
            <p>
              {dorm
                ? "A better move starts with better information."
                : "Make room for a class you’ll remember."}
            </p>
          </div>
          <div>
            <button className="textbutton" onClick={() => setGuidelines(true)}>
              Review guidelines & privacy
            </button>
            <p>
              Independent student reviews. Not affiliated with a university.
              <br />
              No enrollment or residency verification is claimed.
            </p>
          </div>
        </footer>
      </main>
      {compared.length > 0 && (
        <div className="comparebar">
          <span>{compared.length} selected</span>
          <div className="compare-names">
            {compared.map((id) => (
              <button
                key={id}
                onClick={() => toggleCompare(id)}
                aria-label={
                  "Remove " +
                  items.find((x) => x.id === id)?.name +
                  " from comparison"
                }
              >
                {items.find((x) => x.id === id)?.name}
                <X size={14} />
              </button>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => setCompareOpen(true)}
            disabled={compared.length < 2}
          >
            Compare {compared.length}
          </button>
          <button
            aria-label="Clear comparison"
            className="textbutton"
            onClick={() => setCompared([])}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <Dialog
        open={!!current}
        onOpenChange={(v) => {
          if (!v) closeItem();
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <span className="eyebrow">
              {current?.category}
              {current?.example ? " · Fictional example" : ""}
            </span>
            <DialogTitle className="dialog-title">{current?.name}</DialogTitle>
            <DialogDescription>
              {current?.school} · {current?.meta}
            </DialogDescription>
          </DialogHeader>
          {current && (
            <>
              <div className="detail-actions">
                <strong className="large-rating">
                  {fmt(ds.rating)} <small>/ 5</small>
                </strong>
                <span>
                  {ds.count} {ds.count === 1 ? "review" : "reviews"} ·{" "}
                  {term === "all" ? "All terms" : term}
                </span>
                <button
                  className="primary"
                  onClick={() => startReview(current.id)}
                >
                  {current.reviews.some((r) => r.own)
                    ? "Edit your review"
                    : "Write a review"}
                </button>
              </div>
              <div className="detail-tools">
                <button
                  className="textbutton"
                  onClick={() => shareItem(current.id)}
                >
                  Copy listing link <ArrowUpRight size={14} />
                </button>
                <span>
                  {current.example
                    ? "Fictional demo listing"
                    : "Student-submitted listing"}
                </span>
              </div>
              <div className="detail-metrics">
                {c.metrics.map((label, i) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>
                      {fmt(ds[("m" + (i + 1)) as "m1" | "m2" | "m3"])}
                      <small> / 5</small>
                    </strong>
                  </div>
                ))}
                {!dorm && (
                  <div>
                    <span>Outside class</span>
                    <strong>
                      {fmt(ds.hours)}
                      <small> hrs/week</small>
                    </strong>
                  </div>
                )}
              </div>
              <div className="review-filters">
                <Choice
                  label="Review term"
                  value={term}
                  onChange={setTerm}
                  options={[
                    { value: "all", label: "All terms" },
                    ...opts(
                      Array.from(new Set(current.reviews.map((r) => r.term))),
                    ),
                  ]}
                />
                {!dorm && (
                  <Choice
                    label="Review instructor"
                    value={instructor}
                    onChange={setInstructor}
                    options={[
                      { value: "all", label: "All instructors" },
                      ...opts(
                        Array.from(
                          new Set(current.reviews.map((r) => r.instructor)),
                        ).filter(Boolean),
                      ),
                    ]}
                  />
                )}
              </div>
              <p className="fine">
                {dorm
                  ? "Category scores run from 1 (poor) to 5 (excellent)."
                  : "Interest and teaching: higher is better. Difficulty: 1 is easy, 5 is hard. Hours exclude class time."}
              </p>
              {detailReviews.length ? (
                detailReviews.map((r) => (
                  <article key={r.id} className="review">
                    <div className="review-head">
                      <strong>
                        {r.own
                          ? "Your review"
                          : r.example
                            ? "Example student"
                            : "Anonymous reviewer"}
                      </strong>
                      <span>{r.rating} / 5</span>
                    </div>
                    <p className="fine">
                      {r.term}
                      {r.instructor ? " · " + r.instructor : ""}
                      {r.example ? " · Demo" : ""}
                    </p>
                    <p className="review-body">{r.body}</p>
                    <div className="review-foot">
                      <span>
                        {r.recommend
                          ? dorm
                            ? "Would live here again"
                            : "Would take again"
                          : dorm
                            ? "Would choose another dorm"
                            : "Would choose another course"}
                      </span>
                      {r.own && (
                        <div>
                          <button
                            className="textbutton"
                            onClick={() => startReview(current.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="textbutton danger"
                            onClick={() => setDeleteId(r.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <h3>No reviews for this selection.</h3>
                  <p>Share your experience to help the next student.</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reviewItem}
        onOpenChange={(v) => {
          if (!v && !saving) setReviewItem(null);
        }}
      >
        <DialogContent className="review-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">
              Your take on {editing?.name}
            </DialogTitle>
            <DialogDescription>
              {editing?.example
                ? "This is a demo listing. Your saved review will remain labeled as demo content."
                : "Your name and email won’t appear on the review. One review per person per listing; submitting again updates it."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveReview} className="review-form">
            <p className="draft-note">
              Your draft stays here if you close this window. It is cleared when
              you leave or reload the page.
            </p>
            <div className="form-row">
              <label>
                Term
                <input
                  required
                  placeholder={currentTerm()}
                  pattern="(Spring|Summer|Fall|Winter) 20[0-9]{2}"
                  value={review.term}
                  onChange={(e) =>
                    setReview({ ...review, term: e.target.value })
                  }
                />
              </label>
              {!dorm && (
                <label>
                  Instructor
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={review.instructor}
                    onChange={(e) =>
                      setReview({ ...review, instructor: e.target.value })
                    }
                    placeholder="e.g. Dr. Chen"
                  />
                </label>
              )}
            </div>
            <div className="rating-inputs">
              {["Overall", ...c.metrics].map((label, i) => {
                const key = (["rating", "m1", "m2", "m3"] as const)[i];
                return (
                  <label key={key}>
                    {label}
                    <Choice
                      label={label + " rating"}
                      value={String(review[key])}
                      onChange={(v) =>
                        setReview({ ...review, [key]: Number(v) })
                      }
                      options={[
                        { value: "0", label: "Choose…" },
                        ...Array.from({ length: 5 }, (_, n) => ({
                          value: String(n + 1),
                          label:
                            String(n + 1) +
                            (n === 0
                              ? " — " + (!dorm && i === 3 ? "Easy" : "Low")
                              : n === 4
                                ? " — " + (!dorm && i === 3 ? "Hard" : "High")
                                : ""),
                        })),
                      ]}
                    />
                  </label>
                );
              })}
            </div>
            <div className="form-row">
              {!dorm && (
                <label>
                  Hours per week outside class
                  <input
                    required
                    type="number"
                    min="0"
                    max="80"
                    step="0.5"
                    value={review.hours}
                    onChange={(e) =>
                      setReview({ ...review, hours: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                {dorm
                  ? "Would you live here again?"
                  : "Would you take it again?"}
                <Choice
                  label="Would recommend"
                  value={review.recommend || "choose"}
                  onChange={(v) =>
                    setReview({ ...review, recommend: v === "choose" ? "" : v })
                  }
                  options={[
                    { value: "choose", label: "Choose…" },
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </label>
            </div>
            <label>
              Your experience
              <textarea
                required
                minLength={30}
                maxLength={2000}
                rows={5}
                value={review.body}
                onChange={(e) => setReview({ ...review, body: e.target.value })}
                placeholder={
                  dorm
                    ? "What worked? What would you want to know before moving in?"
                    : "What did the workload involve? What made the course worthwhile—or not?"
                }
              />
              <span className="fine">
                {review.body.length}/2000 · Minimum 30 characters. Keep it
                specific; leave out personal information.
              </span>
            </label>
            <label className="checklabel">
              <Checkbox
                checked={review.confirm}
                onCheckedChange={(v) =>
                  setReview({ ...review, confirm: v === true })
                }
              />
              {editing?.example
                ? "I understand this is a fictional demo listing."
                : "This is my own experience, without private information or personal attacks."}
            </label>
            {formError && (
              <p className="error" role="alert" id="form-error" tabIndex={-1}>
                {formError}
              </p>
            )}
            <button className="primary submit" disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          if (!saving) setAddOpen(v);
        }}
      >
        <DialogContent className="review-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">Add a {c.noun}</DialogTitle>
            <DialogDescription>
              Start a listing for a real university. Check the catalog first to
              avoid duplicates. Details are student-submitted.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addListing} className="review-form">
            <label>
              University
              <input
                required
                minLength={2}
                maxLength={120}
                value={newItem.school}
                onChange={(e) =>
                  setNewItem({ ...newItem, school: e.target.value })
                }
                placeholder="Full university name"
              />
            </label>
            <label>
              {dorm ? "Dorm name" : "Course title"}
              <input
                required
                minLength={2}
                maxLength={100}
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
              />
            </label>
            <label>
              {dorm ? "Room style" : "Subject"}
              <Choice
                label="New listing category"
                value={newItem.category}
                onChange={(v) => setNewItem({ ...newItem, category: v })}
                options={opts(c.categories)}
              />
            </label>
            <label>
              {dorm
                ? "Location and bathroom style"
                : "Course code and department"}
              <input
                required
                minLength={2}
                maxLength={160}
                value={newItem.meta}
                onChange={(e) =>
                  setNewItem({ ...newItem, meta: e.target.value })
                }
                placeholder={
                  dorm
                    ? "North campus · Shared bathrooms"
                    : "FILM 104 · Film studies"
                }
              />
            </label>
            <label>
              Features, separated by commas
              <input
                maxLength={164}
                value={newItem.tags}
                onChange={(e) =>
                  setNewItem({ ...newItem, tags: e.target.value })
                }
                placeholder={
                  dorm
                    ? "Air conditioning, Shared kitchen"
                    : "Projects, No final exam"
                }
              />
            </label>
            {formError && (
              <p className="error" role="alert" id="form-error" tabIndex={-1}>
                {formError}
              </p>
            )}
            <button disabled={saving} className="primary submit">
              {saving ? "Saving…" : "Add " + c.noun}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="review-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">
              {dorm ? "Where did you live?" : "What did you take?"}
            </DialogTitle>
            <DialogDescription>
              Choose a {c.noun} to share your experience.
              {!signedIn ? " You’ll sign in before writing." : ""}
            </DialogDescription>
          </DialogHeader>
          <label className="search picker-search">
            <Search size={18} />
            <input
              aria-label="Find a listing to review"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={"Search " + c.plural + " or universities…"}
            />
          </label>
          <div className="picker-results">
            {selectItems(items, {
              query: pickerQuery,
              school: "all",
              category: "all",
              sort: "name",
              maxHours: 0,
              examples: true,
              kind: c.kind,
            }).map((x) => (
              <button key={x.id} onClick={() => startReview(x.id)}>
                <span>
                  <strong>{x.name}</strong>
                  <small>
                    {x.school}
                    {x.example ? " · Demo" : ""}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
          {selectItems(items, {
            query: pickerQuery,
            school: "all",
            category: "all",
            sort: "name",
            maxHours: 0,
            examples: true,
            kind: c.kind,
          }).length === 0 && (
            <p className="fine">No matches. Add the listing to get started.</p>
          )}
          <button
            className="textbutton"
            onClick={() => {
              if (!signedIn) {
                window.location.assign(signInHref);
                return;
              }
              setPickerOpen(false);
              setFormError("");
              setAddOpen(true);
            }}
          >
            <Plus size={16} />
            Can’t find it? Add a {c.noun}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="compare-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">Side by side.</DialogTitle>
            <DialogDescription>
              Compare student-reported averages. Sample sizes and different
              terms matter.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>At a glance</TableHead>
                {compared.map((id) => (
                  <TableHead key={id}>
                    {items.find((x) => x.id === id)?.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                "University",
                "Reviews",
                "Overall",
                ...c.metrics,
                ...(!dorm ? ["Hours / week"] : []),
                "Would choose again",
              ].map((label, i) => (
                <TableRow key={label}>
                  <TableCell>{label}</TableCell>
                  {compared.map((id) => {
                    const x = items.find((x) => x.id === id)!;
                    const s = summary(x.reviews);
                    const values = [
                      x.school + (x.example ? " (Demo)" : ""),
                      String(s.count),
                      displayRating(s.rating),
                      ...(["m1", "m2", "m3"] as const).map((k) =>
                        displayRating(s[k]),
                      ),
                      ...(!dorm ? [fmt(s.hours)] : []),
                      s.recommend === null ? "—" : s.recommend + "%",
                    ];
                    return <TableCell key={id}>{values[i]}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="fine">
            {dorm
              ? "Higher category ratings are better."
              : "Higher interest and teaching ratings are better; higher difficulty means harder."}
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v && !saving) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your review?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your review and updates the listing’s averages. You
              can write a new review later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep review</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void removeReview();
              }}
            >
              Delete review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={guidelines} onOpenChange={setGuidelines}>
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">
              Useful. Honest. Human.
            </DialogTitle>
            <DialogDescription>
              A few things to know about {c.brand}.
            </DialogDescription>
          </DialogHeader>
          <div className="guidelines">
            <h3>Write from experience</h3>
            <p>
              Describe the conditions, workload, or teaching you experienced.
              Include the term. Be specific and fair; no threats, slurs,
              personal attacks, contact details, or room numbers identifying
              residents.
            </p>
            <h3>Your review, your control</h3>
            <p>
              Sign-in lets you update or delete your review. Reviews display
              anonymously; your account identifier is stored privately to
              enforce ownership. We don’t verify enrollment or residency. Your
              email is not saved in the review database.
            </p>
            <h3>Understand the ratings</h3>
            <p>
              Scores are simple averages of the reviews shown. Every review
              counts equally.{" "}
              {dorm
                ? "Higher category ratings are better."
                : "Higher difficulty means harder; higher interest and teaching scores are better. Weekly workload excludes class time."}{" "}
              One review is a starting point, not a consensus.
            </p>
            <h3>Examples stay separate</h3>
            <p>
              Northbridge University is fictional. Its example listings and
              reviews are labeled Demo. Turn off “Include demo campus” to see
              only real user-added listings. Reviews you submit to examples
              remain labeled Demo.
            </p>
            <h3>Independent information</h3>
            <p>
              Listings are student-submitted and may change. Check the
              university’s current housing or course catalog for official
              details, eligibility, fees, and requirements. This first release
              is private to the site owner.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
