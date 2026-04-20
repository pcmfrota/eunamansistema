export const getCurrentLocalDatetime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getCurrentLocalDate = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDateBR = (isoStr: string | null | undefined) => {
  if (!isoStr) return '--/--';
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length < 3) return isoStr;
  const [year, month, day] = parts;
  return `${day}/${month}`;
};

export const formatDateFullBR = (isoStr: string | null | undefined) => {
  if (!isoStr) return '--/--/----';
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length < 3) return isoStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

