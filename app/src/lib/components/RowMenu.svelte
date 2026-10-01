<script lang="ts" module>
  export interface MenuItem {
    label: string;
    run: () => void;
    danger?: boolean;
  }
</script>

<script lang="ts">
  // A "⋯" button on a row of the tree, opening a short menu of actions. The
  // menu is a popover (Escape and a click elsewhere close it), placed by the
  // button; on a phone it rises from the bottom instead.
  import { tick } from "svelte";

  let { label, items }: { label: string; items: MenuItem[] } = $props();

  let open = $state(false);
  let button = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();

  async function toggle(e: MouseEvent) {
    e.preventDefault(); // inside a folder's summary: do not open or close the folder
    e.stopPropagation();
    if (open) { menu?.hidePopover(); return; }
    open = true;
    await tick();
    if (!menu || !button) return;
    const r = button.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.min(r.left, innerWidth - 220))}px`;
    menu.showPopover();
    (menu.querySelector("button") as HTMLButtonElement | null)?.focus();
  }

  function choose(item: MenuItem) {
    menu?.hidePopover();
    item.run();
  }

  // Arrow keys move between the items.
  function keys(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...(menu?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    all[(at + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
  }
</script>

<button class="row-menu" type="button" bind:this={button} aria-label={label} aria-haspopup="menu" aria-expanded={open} onclick={toggle}>
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="12.5" cy="8" r="1.4" /></svg>
</button>
{#if open}
  <div class="row-menu-list" role="menu" aria-label={label} popover="auto" tabindex="-1" bind:this={menu} onkeydown={keys}
    ontoggle={(e) => { if ((e as ToggleEvent).newState === "closed") { open = false; button?.focus(); } }}>
    {#each items as item (item.label)}
      <button type="button" role="menuitem" class={[item.danger && "danger"]} onclick={() => choose(item)}>{item.label}</button>
    {/each}
  </div>
{/if}
