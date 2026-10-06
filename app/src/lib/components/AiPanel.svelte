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
    void ai.state().then((s) => { st = s; loaded = true; });
  });
  const JOB: Record<string, string> = { hint: "Hints", feedback: "Feedback", discuss: "Discussion", marking: "Marking", write: "Writing in notes", "note-ask": "Answers in the editor", "note-fill": "Text proposed in the editor", check: "Checking the connection" };
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
  {#if st.connected}
    <p>Connected to <strong>OpenRouter</strong>{st.from === "environment" ? " (the key is in OPENROUTER_API_KEY)" : ""}.</p>
  {:else}
    <p class="section-note">Working with the teacher in the dashboard (hints, feedback, discussion) calls a model. Connect an OpenRouter account: you sign in there, and rdstudio keeps the key it is given beside your user config, never in a project.</p>
  {/if}
  <div class="teacher-actions">
    {#if !st.connected}
      <button class="toggle primary" type="button" disabled={busy || !learner.enabled} onclick={() => act(() => ai.connect())}>Connect OpenRouter</button>
      {#if !learner.enabled}<span class="section-note">Turn the learner record on first.</span>{/if}
    {:else}
      <button class="toggle" type="button" disabled={busy} onclick={() => act(async () => { const r = await ai.check(); status = `It answered "${r.text}" (${r.model}, ${money(r.cost)}).`; st = await ai.state(); })}>Check the connection</button>
      {#if st.from === "file"}<button class="toggle" type="button" disabled={busy} onclick={() => act(async () => { if (confirm("Forget the OpenRouter key kept here?")) { st = await ai.disconnect(); status = "Forgotten."; } })}>Disconnect</button>{/if}
    {/if}
  </div>
  <p class="edit-status" role="status">{status}</p>

  <h3 class="sub-h">This week</h3>
  <div class="budget" role="img" aria-label={`${money(sp.spent)} of ${money(sp.budget)} spent this week`}>
    <span class={["budget-used", sp.warn && "warn", sp.stopped && "stopped"]} style:width="{Math.min(100, sp.budget ? (100 * sp.spent) / sp.budget : 100)}%"></span>
  </div>
  <p class="section-note">{money(sp.spent)} of {money(sp.budget)} this week, across your projects, in {sp.calls} {sp.calls === 1 ? "call" : "calls"}.
    {sp.stopped ? "The budget is spent: requests stop until Monday." : sp.warn ? "Most of the budget is spent." : ""}
    The budget is <code>[teacher] weekly_budget</code> in the user config.</p>
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

  <h3 class="sub-h">Models</h3>
  <table class="fm spend">
    <tbody>{#each Object.entries(st.models).filter(([k]) => k !== "check") as [job, model] (job)}<tr><th>{JOB[job] ?? job}</th><td><code>{model}</code></td></tr>{/each}</tbody>
  </table>
  <p class="section-note">Set in <code>[teacher.models]</code> in the user config, by job: any model OpenRouter offers. A fast, cheap model suits hints; a strong one, feedback and marking.</p>
{/if}
