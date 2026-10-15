export interface PlaceType {
  id: string;
  name: string;
  icon: string;
  color: string;
  labeled_default: boolean;
  sort: number;
}

export interface Place {
  id: string;
  code: number;
  name: string;
  type: string;
  parent: string;
  photo: string;
  notes: string;
  labeled: boolean;
  label_snapshot: string[] | null;
  printed_at: string;
  updated: string;
}

export interface Item {
  id: string;
  place: string;
  name: string;
  details: string;
  photo: string;
  pinned: boolean;
  sort: number;
  created: string;
}

/** What a label (and its text snapshot) is built from. */
export interface LabelModel {
  code: number;
  name: string;
  /** The place's type name, e.g. "Bin" (shown as "BIN NO."). */
  type?: string;
  /** Ancestor names, outermost first (already trimmed for display). */
  path: string[];
  items: { name: string; details: string[]; pinned: boolean }[];
  children: { name: string; code: number }[];
}

export const pad4 = (code: number) => '#' + String(code).padStart(4, '0');

export interface ClientItem {
  id: string;
  name: string;
  details: string;
  pinned: boolean;
  photo: string;
  sort: number;
}
