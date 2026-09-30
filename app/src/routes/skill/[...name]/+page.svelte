<script lang="ts">
  import { page } from "$app/state";
  import SkillPage from "$lib/components/SkillPage.svelte";
</script>

<SkillPage kind="skill" name={page.params.name ?? ""} />
