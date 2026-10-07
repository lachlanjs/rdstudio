<script lang="ts">
  // The status line (T61): where you are, what the page reports, and the keys
  // that work here. Station shows it along the bottom; the keys work in either
  // theme, and ? lists them.
  //
  // 1 to 4 go to the spaces. A page offers a key by marking a button or link
  // with data-key (and data-key-label, if its text is not the word wanted):
  // the key clicks it. Nothing fires while you are typing.
  let { mode, items }: { mode: string; items: string[] } = $props();

  let keys = $state<[string, string][]>([]);
  let help = $state(false);

  const offered = () => [...document.querySelectorAll<HTMLElement>("#view [data-key]")]
    .filter((el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled);

  function scan() {
    const seen = new Map<string, string>();
    for (const el of offered()) {
      const k = el.dataset.key!;
      if (!seen.has(k)) seen.set(k, el.dataset.keyLabel || (el.textContent ?? "").trim().split(/\s*\(/)[0]!.toLowerCase());
    }
    const next = [...seen];
    if (JSON.stringify(next) !== JSON.stringify(keys)) keys = next;
  }

  // The page changes under the line (navigation, an exercise opening): look again, not on every keystroke.
  $effect(() => {
    const view = document.getElementById("view");
    if (!view) return;
    let due = 0;
    const later = () => { clearTimeout(due); due = window.setTimeout(scan, 150); };
    const watch = new MutationObserver(later);
    watch.observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-key", "disabled", "hidden"] });
    later();
    return () => { watch.disconnect(); clearTimeout(due); };
  });

  function onkey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable], .cm-editor, dialog")) return;
    if (e.key === "Escape") { help = false; return; }
    if (e.key === "?") { help = !help; e.preventDefault(); return; }
    if (e.key >= "1" && e.key <= "4") {
      const tab = document.querySelectorAll<HTMLAnchorElement>(".bar .tabs a")[Number(e.key) - 1];
      if (tab) { e.preventDefault(); tab.click(); }
      return;
    }
    const el = offered().find((x) => x.dataset.key === e.key);
    if (el) { e.preventDefault(); el.click(); }
  }
</script>

<svelte:window onkeydown={onkey} />

<footer class="status" aria-label="Status">
  <b>{mode}</b>
  {#each items as t (t)}<span>{t}</span>{/each}
  <span class="sp"></span>
  <span><kbd>1-4</kbd> spaces</span>
  {#each keys as [k, label] (k)}<span><kbd>{k}</kbd> {label}</span>{/each}
  <span><kbd>?</kbd> keys</span>
</footer>
{#if help}
  <div class="status-keys" role="dialog" aria-label="Keys">
    <p><kbd>1</kbd>–<kbd>4</kbd> the spaces, in the order of the bar</p>
    {#each keys as [k, label] (k)}<p><kbd>{k}</kbd> {label}</p>{/each}
    <p><kbd>?</kbd> this list · <kbd>Esc</kbd> closes it</p>
  </div>
{/if}
