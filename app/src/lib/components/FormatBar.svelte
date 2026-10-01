<script lang="ts">
  // Formatting buttons for the editor: what is awkward to type on a phone's
  // keyboard (#, **, [[, $) and undo. On a desktop it sits under the editing
  // bar, each button naming its shortcut; on a phone it rides above the
  // on-screen keyboard. Pressing a button does not take the focus from the
  // text, so the keyboard stays up.
  import { onMount } from "svelte";
  import type { Format } from "$lib/editor/codemirror.ts";

  let { onformat, hidden = false }: { onformat: (what: Format) => void; hidden?: boolean } = $props();

  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? "⌘" : "Ctrl+";
  const BUTTONS: { what: Format; label: string; keys?: string; group?: boolean }[] = [
    { what: "heading", label: "Heading", keys: `${mod}Shift+H` },
    { what: "bold", label: "Bold", keys: `${mod}B` },
    { what: "italic", label: "Italic", keys: `${mod}I` },
    { what: "link", label: "Link to a note", keys: `${mod}K` },
    { what: "maths", label: "Maths", keys: `${mod}Shift+M` },
    { what: "list", label: "Bulleted list", keys: `${mod}Shift+8` },
    { what: "undo", label: "Undo", keys: `${mod}Z`, group: true },
    { what: "redo", label: "Redo", keys: mac ? "⌘Shift+Z" : "Ctrl+Y" },
  ];

  // Above the on-screen keyboard. Android shrinks the page for the keyboard
  // (app.html), so the bar simply sits at the bottom. Where the keyboard
  // covers the page instead (iOS), it is lifted by the gap between the
  // visible part of the page and the bottom of the window. The browser's
  // last report can come before the keyboard or a scroll has settled, so it
  // is checked again each frame until the gap has stayed the same for a while.
  let bar = $state<HTMLDivElement>();
  onMount(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let gap = -1, still = 0, frame = 0;
    const measure = () => Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    const tick = () => {
      const now = measure();
      if (now !== gap) { gap = now; still = 0; bar?.style.setProperty("--keyboard", `${gap}px`); }
      frame = ++still < 20 ? requestAnimationFrame(tick) : 0;
    };
    const place = () => { still = 0; if (!frame) frame = requestAnimationFrame(tick); };
    tick();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    addEventListener("focusin", place);
    addEventListener("focusout", place);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
      removeEventListener("focusin", place);
      removeEventListener("focusout", place);
    };
  });
</script>

<div class="format-bar" role="toolbar" aria-label="Formatting" bind:this={bar} {hidden}>
  {#each BUTTONS as b (b.what)}
    <button type="button" class={["format", b.group && "group"]} aria-label={b.label} title={b.keys ? `${b.label} (${b.keys})` : b.label}
      onpointerdown={(e) => e.preventDefault()} onclick={() => onformat(b.what)}>
      {#if b.what === "heading"}<span class="glyph heading">H</span>
      {:else if b.what === "bold"}<span class="glyph bold">B</span>
      {:else if b.what === "italic"}<span class="glyph italic">I</span>
      {:else if b.what === "maths"}<span class="glyph maths">∑</span>
      {:else}
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          {#if b.what === "link"}<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9" /><path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" />
          {:else if b.what === "list"}<path d="M8 5.5h8M8 10h8M8 14.5h8" /><circle cx="4.2" cy="5.5" r=".6" fill="currentColor" /><circle cx="4.2" cy="10" r=".6" fill="currentColor" /><circle cx="4.2" cy="14.5" r=".6" fill="currentColor" />
          {:else if b.what === "undo"}<path d="M7.5 5 4 8.5 7.5 12" /><path d="M4.5 8.5H12a4 4 0 0 1 0 8H9" />
          {:else}<path d="M12.5 5 16 8.5 12.5 12" /><path d="M15.5 8.5H8a4 4 0 0 0 0 8h3" />{/if}
        </svg>
      {/if}
    </button>
  {/each}
</div>
