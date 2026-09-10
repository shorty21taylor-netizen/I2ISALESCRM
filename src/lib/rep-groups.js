// The three ways a rep works a deal. Kept in its own module with no imports so
// client pages can label a group without pulling the report engine — and the
// database driver behind it — into the browser bundle.
export var GROUP_LABELS = {
  closers: 'Closers',
  setters: 'Setters',
  dmSetters: 'DM Setters',
};

export var GROUP_ORDER = ['closers', 'setters', 'dmSetters'];
