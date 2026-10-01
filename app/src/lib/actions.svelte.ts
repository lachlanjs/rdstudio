// Actions on notes and folders (create, move, delete), opened from anywhere:
// the tree's menus, a folder's page, a note's page. ActionDialogs, mounted
// once in the layout, shows the dialog for the action asked for.

export type Action =
  | { kind: "new-note"; folder: string }
  | { kind: "new-folder"; folder: string }
  | { kind: "move-note"; id: string }
  | { kind: "delete-note"; id: string }
  | { kind: "move-folder"; id: string }
  | { kind: "delete-folder"; id: string };

class Actions {
  current = $state.raw<Action | null>(null);
  open(action: Action): void { this.current = action; }
  close(): void { this.current = null; }
}

export const actions = new Actions();
