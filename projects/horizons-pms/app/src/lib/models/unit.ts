import type { BedLayout } from "@/lib/models/room-type";

export const UNIT_STATUSES = ["available", "occupied", "maintenance", "reserved"] as const;
export const UNIT_TOWERS = [1, 2] as const;
export const BED_SETUPS = ["king", "twin"] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];
export type UnitTower = (typeof UNIT_TOWERS)[number];
export type BedSetup = (typeof BED_SETUPS)[number];

export type Unit = {
  id: string;
  unit_number: string;
  room_number: string;
  unit_code: string;
  floor: number;
  room_type_id: string;
  tower: UnitTower;
  bed_setup: BedSetup;
  bed_layout: BedLayout;
  status: UnitStatus;
  amenities: string[];
  base_rate: string;
  maintenance_issue_description: string | null;
  maintenance_reported_at: string | null;
  maintenance_status: string | null;
  maintenance_resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  room_type?: {
    id: string;
    name: string;
  } | null;
};

export type CreateUnitInput = {
  floor: number;
  room_number: string;
  room_type_id: string;
  tower: UnitTower;
  bed_setup: BedSetup;
  bed_layout: BedLayout;
  status: UnitStatus;
  base_rate: number;
};
