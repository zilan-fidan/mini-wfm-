// 5353882217 → "535 388 22 17"; boşsa "-"
export const formatPhone = (phone: string | null) => {
  if (!phone) return '-';
  const match = phone.match(/^(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return match ? match.slice(1).join(' ') : phone;
};
