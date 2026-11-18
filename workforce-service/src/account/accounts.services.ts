import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  // Kullanıcı adına göre hesap bul
  async findByUsername(username: string) {
    return this.accountRepository.findOne({
      where: { username },
    });
  }

  // Yeni hesap kaydet
  async createAccount(data: Partial<Account>) {
    const account = this.accountRepository.create(data);
    return this.accountRepository.save(account);
  }

  // Bütün hesapları getir
  async findAllAccounts() {
    return this.accountRepository.find({
      order: { id: 'ASC' },
    });
  }

  // Şifre hash'i ile birlikte hesap bul
  async findByUsernameWithPassword(username: string) {
    return this.accountRepository
      .createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.username = :username', { username })
      .getOne();
  }
}
