export const ROOM_TYPE_NAMES = ["studio", "1bed", "2bed", "3bed"] as const;

export type RoomTypeName = (typeof ROOM_TYPE_NAMES)[number];

export const BED_LAYOUTS = ["king", "twin", "king+king", "twin+twin", "king+twin", "king+king+twin"] as const;

export type BedLayout = (typeof BED_LAYOUTS)[number];

export type RoomType = {
  id: string;
  name: RoomTypeName;
  base_capacity: number;
  max_capacity: number;
  amenities: string[];
  base_rate: string;
  description: string | null;
  allow_extra_bed: boolean;
  bedrooms_count: number;
  allowed_bed_layouts: BedLayout[];
  created_at: string;
  updated_at: string;
};

export type CreateRoomTypeInput = {
  name: RoomTypeName;
  base_capacity: number;
  max_capacity: number;
  description?: string;
};

export const BED_LAYOUT_LABELS: Record<BedLayout, string> = {
  king: "King",
  twin: "Twin",
  "king+king": "King + King",
  "twin+twin": "Twin + Twin",
  "king+twin": "King + Twin",
  "king+king+twin": "King + King + Twin",
};

export const DEFAULT_LAYOUTS_BY_ROOM_TYPE: Record<RoomTypeName, BedLayout[]> = {
  studio: ["king", "twin"],
  "1bed": ["king", "twin"],
  "2bed": ["king+king", "twin+twin", "king+twin"],
  "3bed": ["king+king+twin"],
};
