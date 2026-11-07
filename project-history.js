// Undo/redo by snapshots. observe() is called after every model render: when the serialized
// project differs from the last known state, that state becomes an undo step. So every action
// that ends in a render is undoable without wiring each handler separately.

export function createUndoHistory({ serialize, restore, limit = 100 }) {
  let baseline = null;
  const undoStack = [];
  const redoStack = [];
  return {
    observe() {
      const current = serialize();
      if (baseline === null) {
        baseline = current;
        return false;
      }
      if (current === baseline) return false;
      undoStack.push(baseline);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
      baseline = current;
      return true;
    },
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(serialize());
      baseline = undoStack.pop();
      restore(baseline);
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(serialize());
      baseline = redoStack.pop();
      restore(baseline);
      return true;
    },
    // A new project (opened file, restored revision) starts a fresh history.
    reset() {
      baseline = serialize();
      undoStack.length = 0;
      redoStack.length = 0;
    },
    get undoCount() { return undoStack.length; },
    get redoCount() { return redoStack.length; },
  };
}
