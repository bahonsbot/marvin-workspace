export const ROOM_TYPE_NAMES = ["studio", "1bed", "2bed", "3bed"] as const;

export type RoomTypeName = (typeof ROOM_TYPE_NAMES)[number];

export type RoomType = {
  id: string;
  name: RoomTypeName;
  base_capacity: number;
  max_capacity: number;
  amenities: string[];
  base_rate: string;
  description: string | null;
  allow_extra_bed: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateRoomTypeInput = {
  name: RoomTypeName;
  base_capacity: number;
  max_capacity: number;
  description?: string;
};
