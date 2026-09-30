<script lang="ts">
  // Mounts a view built imperatively (the map and graph, ported from the old
  // dashboard as they were): make() builds its element; when the data version
  // changes the element's refresh() updates it in place, and leave() cleans up.
  import { untrack } from "svelte";
  import { store } from "$lib/data.svelte.ts";

  type View = HTMLElement & { refresh?: () => void; leave?: () => void };
  let { make, leave }: { make: () => View; leave?: () => void } = $props();

  let view: View | undefined;

  function mount(host: HTMLElement) {
    view = untrack(make);
    host.replaceChildren(view);
    return () => {
      view?.leave?.();
      leave?.();
      view = undefined;
    };
  }

  // Live updates: refresh in place, keeping the view's position and state.
  let seen: string | null | undefined;
  $effect(() => {
    const v = store.version;
    if (seen !== undefined && v !== seen) untrack(() => view?.refresh?.());
    seen = v;
  });
</script>

<div style="display: contents" {@attach mount}></div>
