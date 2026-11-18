// api tarafında ListWorkOrdersQueryDto ile doğrulanmış olarak gelir
export class FindAllWorkOrdersDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  priority?: string;
  teamId?: number;
  overdue?: boolean;
  sortBy?: string;
  sortOrder?: string;
}
