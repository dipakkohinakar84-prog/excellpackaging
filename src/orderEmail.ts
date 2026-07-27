import { pb } from './pocketbase';

export type OrderEmailType = 'accepted' | 'received' | 'dispatched';

export interface OrderEmailPayload {
  type: OrderEmailType;
  to?: string;
  erpOrderId: number | string;
  itemName: string;
  qty: number | string;
  etd?: string;
  dispatchedDate?: string;
}

const isValidEmail = (value?: string) => !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const sendOrderEmail = async (payload: OrderEmailPayload) => {
  const apiUrl = import.meta.env.VITE_ORDER_EMAIL_API_URL as string | undefined;
  if (!apiUrl || !isValidEmail(payload.to)) return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (pb.authStore.token) headers.Authorization = `Bearer ${pb.authStore.token}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown error');
      console.error('Order email HTTP error:', response.status, body);
    }
  } catch (error) {
    console.error('Order email request failed:', error);
  }
};
