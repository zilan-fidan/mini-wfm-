import { http } from './http';
import type { Account, CreateAccountPayload } from '../types/account';

export async function listAccounts(): Promise<Account[]> {
  const { data } = await http.get<Account[]>('/accounts');
  return data;
}

export async function createAccount(payload: CreateAccountPayload): Promise<Account> {
  const { data } = await http.post<Account>('/accounts', payload);
  return data;
}
