<script lang="ts">
  // The Teacher page's models section (T50): whether an OpenRouter account is
  // connected, the model for each job, and this week's spending against the
  // budget, by feature and by model.
  import { onMount } from "svelte";
  import type { AiState } from "$lib/api/types.gen.ts";
  import { learner } from "$lib/data.svelte.ts";
  import { ai, money } from "$lib/teacher.svelte.ts";

  let st = $state<AiState | null>(null);
  let loaded = $state(false);
  let status = $state(""), busy = $state(false);

  const RETURN: Record<string, string> = {
    connected: "Connected to OpenRouter.",
    expired: "Connecting took too long or was interrupted; try again.",
    refused: "OpenRouter did not hand over a key; try again.",
    failed: "Could not reach OpenRouter to finish connecting.",
  };
  onMount(() => {
    const back = new URLSearchParams(location.search).get("ai");
    if (back && RETURN[back]) status = RETURN[back];
    void ai.state().then((s) => { st = s; loaded = true; if (s) { tiers = { ...s.tiers }; limits = shown(s); } });
  });
  // The editor's three tiers (T83): which model each one is.
  const TIER = [["low", "Low", "Small, mechanical changes: quick and cheap"], ["mid", "Mid", "Most questions and drafting"], ["max", "Max", "Figures, and what needs the most care"]] as const;
  let tiers = $state({ low: "", mid: "", max: "" });
  const tiersChanged = $derived(!!st && TIER.some(([k]) => tiers[k].trim() !== st!.tiers[k]));
  // Each tier's limits (T110), as typed: empty is none.
  type Typed = Record<"low" | "mid" | "max", { input: string; output: string }>;
  const shown = (s: AiState): Typed => Object.fromEntries(TIER.map(([k]) => [k, { input: s.limits?.[k]?.input?.toString() ?? "", output: s.limits?.[k]?.output?.toString() ?? "" }])) as Typed;
  let limitStatus = $state(""); // said under the form itself, which is far down the page from the panel's own status
  let limits = $state<Typed>({ low: { input: "", output: "" }, mid: { input: "", output: "" }, max: { input: "", output: "" } });
  const limitsChanged = $derived(!!st?.limits && TIER.some(([k]) => (["input", "output"] as const).some((f) => limits[k][f].trim() !== (st!.limits[k][f]?.toString() ?? ""))));
  /** What was typed, as it is sent: a whole number, or null for none. Anything else is said, not sent. */
  function typedLimits() {
    const out: Partial<Record<"low" | "mid" | "max", { input: number | null; output: number | null }>> = {};
    for (const [k, label] of TIER) {
      const one = (f: "input" | "output") => {
        const t = limits[k][f].trim().replace(/[,_ ]/g, "");
        if (!t) return null;
        if (!/^\d+$/.test(t)) throw new Error(`${label}, ${f}: write a whole number of tokens, or leave it empty for none.`);
        return Number(t);
      };
      out[k] = { input: one("input"), output: one("output") };
    }
    return out;
  }
  const JOB: Record<string, string> = { hint: "Hints", feedback: "Feedback", discuss: "Discussion", marking: "Marking", write: "Writing in notes", "note-ask": "Answers in the editor", "note-fill": "Text proposed in the editor", "note-figure": "Figures made in the editor", check: "Checking the connection" };
  const sorted = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]);

  async function act(f: () => Promise<unknown>) {
    busy = true; status = "";
    try { await f(); } catch (err) { status = (err as Error).message; }
    busy = false;
  }
</script>

{#if !loaded}
  <p class="section-note">Loading…</p>
{:else if !st}
  <p class="section-note">This server does not call models yet: update rdstudio and restart rdstudio serve.</p>
{:else}
  {@const sp = st.spending}
  {@const own = st.provider?.custom === true}
  {#if own}
    <!-- An organisation's own gateway ([teacher.provider] in the user config): nothing to sign in to here. -->
    <p>Models come from <strong>{st.provider.name}</strong> (<code>{st.provider.host}</code>), set in <code>[teacher.provider]</code> in your user config.
      {st.connected ? (st.from === "none" ? "It needs no key." : `Its key comes from ${st.from === "command" ? "a command" : st.from === "file" ? "a file" : "the environment"}.`) : "It has no key yet: set one as the provider's settings say."}
      <code>rdstudio provider check</code> on the command line says what is wrong when a request fails.</p>
  {:else if st.connected}
    <p>Connected to <strong>OpenRouter</strong>{st.from === "environment" ? " (the key is in OPENROUTER_API_KEY)" : ""}.</p>
  {:else}
    <p class="section-note">Working with Axis in the dashboard (hints, feedback, discussion) calls a model. Connect an OpenRouter account: you sign in there, and rdstudio keeps the key it is given beside your user config, never in a project.</p>
  {/if}
  <div class="teacher-actions">
    {#if !st.connected && own}
      <span class="section-note">Nothing can be asked until the key is set.</span>
    {:else if !st.connected}
      <button class="toggle primary" type="button" disabled={busy || !learner.enabled} onclick={() => act(() => ai.connect())}>Connect OpenRouter</button>
      {#if !learner.enabled}<span class="section-note">Turn the learner record on first.</span>{/if}
    {:else}
      <button class="toggle" type="button" disabled={busy} onclick={() => act(async () => { const r = await ai.check(); status = `It answered "${r.text}" (${r.model}, ${money(r.cost)}).`; st = await ai.state(); })}>Check the connection</button>
      {#if st.from === "file" && !own}<button class="toggle" type="button" disabled={busy} onclick={() => act(async () => { if (confirm("Forget the OpenRouter key kept here?")) { st = await ai.disconnect(); status = "Forgotten."; } })}>Disconnect</button>{/if}
    {/if}
  </div>
  <p class="edit-status" role="status">{status}</p>

  <h3 class="sub-h">This week</h3>
  <div class="budget" role="img" aria-label={`${money(sp.spent)} of ${money(sp.budget)} spent this week`}>
    <span class={["budget-used", sp.warn && "warn", sp.stopped && "stopped"]} style:width="{Math.min(100, sp.budget ? (100 * sp.spent) / sp.budget : 100)}%"></span>
  </div>
  <p class="section-note">{money(sp.spent)} of {money(sp.budget)} this week, across your projects, in {sp.calls} {sp.calls === 1 ? "call" : "calls"}.
    {sp.stopped ? "The budget is spent: requests stop until Monday." : sp.warn ? "Most of the budget is spent." : ""}
    The budget is <code>[teacher] weekly_budget</code> in the user config.
    {#if own && !st.provider.priced}No prices are set for {st.provider.name}'s models, so spending shows as nothing and the budget stops nothing: set them under <code>[teacher.provider.prices]</code>.{/if}</p>
  {#if sp.calls}
    <table class="fm spend">
      <tbody>
        {#each sorted(sp.byFeature) as [k, v] (k)}<tr><th>{JOB[k] ?? k}</th><td>{money(v)}</td></tr>{/each}
      </tbody>
    </table>
    <details class="spend-more"><summary>By model and exercise</summary>
      <table class="fm spend"><tbody>
        {#each sorted(sp.byModel) as [k, v] (k)}<tr><th><code>{k}</code></th><td>{money(v)}</td></tr>{/each}
        {#each sorted(sp.byExercise) as [k, v] (k)}<tr><th>{k}</th><td>{money(v)}</td></tr>{/each}
      </tbody></table>
    </details>
  {/if}

  <h3 class="sub-h">Models in the editor</h3>
  <p class="section-note">Asking Axis in a note, you choose how strong a model the request is worth. Each tier is a model, written as {own ? st.provider.name : "OpenRouter"} {own ? "names" : "lists"} it.</p>
  <form class="tiers" onsubmit={(e) => { e.preventDefault(); void act(async () => { st = await ai.setTiers({ low: tiers.low.trim(), mid: tiers.mid.trim(), max: tiers.max.trim() }); tiers = { ...st.tiers }; status = "The editor's models are set."; }); }}>
    {#each TIER as [k, label, hint] (k)}
      <label for="tier-{k}">{label}</label>
      <input id="tier-{k}" type="text" bind:value={tiers[k]} spellcheck="false" autocomplete="off" aria-describedby="tier-{k}-hint" />
      <span class="section-note" id="tier-{k}-hint">{hint}</span>
    {/each}
    <span></span><button class="toggle" type="submit" disabled={busy || !tiersChanged}>Save the models</button>
  </form>

  {#if st.limits}
    <h3 class="sub-h" id="limits">Limits</h3>
    <p class="section-note">How much may be sent to each tier's model in one call, and how long its reply may be, in tokens. Leave one empty and rdstudio uses its own figures, which differ by the kind of request.
      With an input limit, what was looked up and gathered is shortened to fit; your own words, the instructions and the passage being changed are never cut. Set an output limit lower where {own ? st.provider.name : "the provider"} allows less, or higher for a model that spends its reply on reasoning.
      Hints and marking take the limits of the tier their job belongs to (hints: low; the rest: mid).</p>
    <form class="limits" onsubmit={async (e) => { e.preventDefault(); busy = true; limitStatus = ""; try { st = await ai.setLimits(typedLimits()); limits = shown(st); limitStatus = "The limits are set."; } catch (err) { limitStatus = (err as Error).message; } busy = false; }}>
      <span></span><span class="section-note" id="limit-in">Input, at most</span><span class="section-note" id="limit-out">Output, at most</span>
      {#each TIER as [k, label] (k)}
        <label for="limit-{k}-input">{label}</label>
        <input id="limit-{k}-input" type="text" inputmode="numeric" bind:value={limits[k].input} placeholder="no limit" autocomplete="off" aria-label="{label}: input limit, in tokens" />
        <input id="limit-{k}-output" type="text" inputmode="numeric" bind:value={limits[k].output} placeholder="rdstudio's own" autocomplete="off" aria-label="{label}: output limit, in tokens" />
      {/each}
      <span></span><button class="toggle" type="submit" disabled={busy || !limitsChanged}>Save the limits</button>
    </form>
    <p class="edit-status limits-status" role="status">{limitStatus}</p>
  {/if}

  <h3 class="sub-h">Models elsewhere</h3>
  <table class="fm spend">
    <tbody>{#each Object.entries(st.models).filter(([k]) => k !== "check" && k !== "write") as [job, model] (job)}<tr><th>{JOB[job] ?? job}</th><td><code>{model}</code></td></tr>{/each}</tbody>
  </table>
  <p class="section-note">Set in <code>[teacher.models]</code> in the user config, by job: any model {own ? st.provider.name : "OpenRouter"} offers. A fast, cheap model suits hints; a strong one, feedback and marking.</p>
{/if}
