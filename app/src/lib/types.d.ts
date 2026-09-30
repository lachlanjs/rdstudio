declare module "markdown-it-texmath" {
  import type MarkdownIt from "markdown-it";
  const texmath: MarkdownIt.PluginWithOptions<Record<string, unknown>>;
  export default texmath;
}

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";
  const footnote: MarkdownIt.PluginSimple;
  export default footnote;
}
