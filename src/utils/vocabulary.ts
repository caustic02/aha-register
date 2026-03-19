/**
 * Getty AAT vocabulary display utilities.
 *
 * The bundled AAT JSON uses angle brackets `<…>` to denote hierarchical
 * category containers (e.g. "<adhesive by composition or origin>").
 * These are machine notation — strip them before rendering to users.
 */

/**
 * Strip Getty AAT machine-formatting from a label for human display.
 *
 * Currently handles:
 * - Angle brackets: `<oil paint>` → `oil paint`
 */
export function cleanAatLabel(label: string): string {
  if (!label) return label;
  return label.replace(/^<|>$/g, '');
}
