// THROWAWAY: three inbox placements on existing app routes via ?variant=A|B|C.
// Fake activity only. No provider, persistence, or production notification delivery.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Dialog } from "radix-ui";
import { Bell } from "lucide-react";

const names = { A: "Account-adjacent popover", B: "Right reading drawer", C: "Workspace inbox" };
type Variant = keyof typeof names;
type Item = { id: number; title: string; target: string; read: boolean; archived: boolean };
const examples = {
  Student: ["New lesson: Working with state", "Instructor replied to your lesson question", "Course deadline changed: Friday, 5pm"],
  Instructor: ["New question on Working with state", "Student replied in a lesson discussion", "Platform Admin replied to your help request"],
  "Platform Admin": ["New platform help request assigned to you", "Requester replied to your platform help conversation"],
};
function seed(role: keyof typeof examples): Item[] {
  return examples[role].map((title, i) => ({ id: i + 1, title, target: title.includes("help") ? "Private platform help conversation" : title.includes("question") || title.includes("replied") ? "Lesson discussion · exact question and reply" : "Affected course or lesson", read: i === 2, archived: false }));
}
const control = "rounded border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

export function NotificationInboxPrototype({ placement }: { placement: "account" | "workspace" }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("variant");
  const variant: Variant = raw === "B" || raw === "C" ? raw : "A";
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<keyof typeof examples>("Student");
  const [items, setItems] = useState(() => seed("Student"));
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [destination, setDestination] = useState("");
  const [popup, setPopup] = useState<Item | null>(null);
  const sequence = useRef(100);
  const unread = items.filter(i => !i.read && !i.archived).length;
  const visible = items.filter(i => !i.archived && (!unreadOnly || !i.read));
  function cycle(delta: number) {
    const keys: Variant[] = ["A", "B", "C"];
    setParams(previous => { previous.set("variant", keys[(keys.indexOf(variant) + delta + 3) % 3]); return previous; }, { replace: true });
    setOpen(false);
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!raw || (placement === "account") !== (variant === "A")) return;
      if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); cycle(event.key === "ArrowLeft" ? -1 : 1); }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 8000);
    return () => window.clearTimeout(timer);
  }, [popup]);
  if (!import.meta.env.DEV || !raw || (placement === "account") !== (variant === "A")) return null;
  function patch(id: number, update: Partial<Item>) { setItems(current => current.map(i => i.id === id ? { ...i, ...update } : i)); }
  function visit(item: Item) { patch(item.id, { read: true }); setDestination(item.target); setPopup(null); }
  const content = <>
    <div className="flex flex-wrap gap-2 border-b p-4">
      <button className={control} onClick={() => setUnreadOnly(false)} aria-pressed={!unreadOnly}>All</button>
      <button className={control} onClick={() => setUnreadOnly(true)} aria-pressed={unreadOnly}>Unread ({unread})</button>
      <button className={control} onClick={() => setItems(current => current.map(i => ({ ...i, read: true })))}>Mark all read</button>
    </div>
    <div className="max-h-[50vh] overflow-y-auto">
      {visible.length === 0 && <p className="p-8">{unreadOnly ? "You're all caught up. Switch to All for read notifications." : "No notifications yet. New activity will appear here."}</p>}
      {visible.map(item => <article key={item.id} className={`border-b p-4 ${item.read ? "" : "bg-primary/5"}`}>
        <button className="block w-full text-left underline-offset-4 hover:underline focus-visible:outline-2" onClick={() => visit(item)}>
          <span className="text-xs text-muted-foreground">{item.read ? "Read" : "● Unread"} · Just now</span>
          <strong className="mt-1 block">{item.title}</strong>
          <span className="text-xs text-muted-foreground">{item.target}</span>
        </button>
        <div className="mt-3 flex gap-2">
          <button className={control} onClick={() => patch(item.id, { read: !item.read })}>Mark {item.read ? "unread" : "read"}</button>
          <button className={control} onClick={() => patch(item.id, { archived: true })}>Archive</button>
        </div>
      </article>)}
    </div>
    {destination && <p role="status" className="border-t bg-muted p-4 text-sm">Destination preview: {destination}. Production would navigate there; this demo stays here.</p>}
  </>;
  return <>
    {variant === "C" ? <section className="m-6 rounded-xl border bg-background">
      <div className="flex justify-between p-4"><h2 className="text-xl font-semibold">Notifications · {unread} unread</h2><button className={control} onClick={() => setOpen(!open)}>{open ? "Collapse" : "Expand inbox"}</button></div>
      {open && content}
    </section> : <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><button className={`${control} ${variant === "B" ? "fixed right-6 top-4 z-30 bg-background shadow" : "w-full text-left"}`} aria-label={`Notifications, ${unread} unread`}><Bell aria-hidden="true" className="mr-2 inline size-4" />Notifications {unread > 0 && <span className="rounded-full bg-primary px-2 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}</button></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" /><Dialog.Content className={`fixed z-50 overflow-auto border bg-background shadow-xl ${variant === "A" ? "bottom-24 left-4 max-h-[75vh] w-[min(420px,calc(100vw-32px))] rounded-xl" : "inset-y-0 right-0 w-[min(480px,100vw)]"}`}>
        <div className="flex items-center justify-between p-4"><Dialog.Title className="text-xl font-semibold">Notifications</Dialog.Title><Dialog.Close className={control}>Close</Dialog.Close></div>
        <Dialog.Description className="px-4 pb-3 text-sm text-muted-foreground">Opening the inbox leaves entries unread. Choose an entry to read it.</Dialog.Description>{content}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>}
    {popup && <aside className="fixed right-6 top-20 z-50 w-80 rounded-xl border bg-background p-4 shadow-xl" aria-label="Incoming activity preview"><p role="status">New notification</p><button className="my-2 text-left font-semibold" onClick={() => { visit(popup); setOpen(true); }}>{popup.title}</button><button className={control} onClick={() => setPopup(null)}>Dismiss popup</button></aside>}
    <div className="fixed bottom-20 left-1/2 z-[60] w-[min(600px,90vw)] -translate-x-1/2 rounded-lg border bg-background p-3 text-xs shadow">
      <p className="mb-2 font-semibold">THROWAWAY · synthetic activity · proposed behavior, awaiting your decision</p>
      <div className="flex flex-wrap gap-2"><select className={control} aria-label="Preview notification recipient role" value={role} onChange={e => { const next = e.target.value as keyof typeof examples; setRole(next); setItems(seed(next)); setDestination(""); setPopup(null); }}>{Object.keys(examples).map(r => <option key={r}>{r}</option>)}</select>
      <button className={control} onClick={() => { const item = { ...seed(role)[0], id: sequence.current++ }; setItems(current => [item, ...current]); setPopup(item); }}>Simulate arrival</button>
      <button className={control} onClick={() => setItems([])}>Empty inbox</button><button className={control} onClick={() => {setItems(seed(role)); setDestination("");}}>Reset</button></div>
      <p className="mt-2">State: {JSON.stringify({ variant, role, open, unread, entries: items.map(({ id, read, archived }) => ({ id, read, archived })), popup: popup?.id ?? null, destination })}</p>
    </div>
    <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 rounded-full bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"><button aria-label="Previous variant" onClick={() => cycle(-1)}>←</button><span>{variant} · {names[variant]}</span><button aria-label="Next variant" onClick={() => cycle(1)}>→</button></div>
  </>;
}
