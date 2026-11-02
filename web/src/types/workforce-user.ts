// Personel cevaplarındaki ekip özeti
export type TeamSummary = {
  id: number;
  name: string;
};

export type WorkforceUser = {
  id: number;
  firstname: string;
  lastname: string;
  registrationNumber: string;
  phone: string | null;
  isActive: boolean;
  teamId: number | null; // null = ekipsiz
  team?: TeamSummary | null; // liste ve detayda gelir, ekip detayındaki üyelerde gelmez
  createdAt: string; // JSON'da tarih metindir
  updatedAt: string;
};

export type CreateWorkforceUserPayload = {
  firstname: string;
  lastname: string;
  registrationNumber: string;
  phone?: string;
  isActive?: boolean;
};

export type UpdateWorkforceUserPayload = {
  firstname?: string;
  lastname?: string;
  registrationNumber?: string;
  phone?: string | null; // null = telefonu temizle
  isActive?: boolean;
};

export type ListWorkforceUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};
