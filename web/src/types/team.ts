export type Team = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string; // JSON'da tarih metindir
  updatedAt: string;
};

export type CreateTeamPayload = {
  name: string;
  description?: string;
};

export type UpdateTeamPayload = {
  name?: string;
  description?: string;
  isActive?: boolean;
};

export type ListTeamsParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};