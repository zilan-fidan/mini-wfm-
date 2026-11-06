import {Controller,HttpStatus,UsePipes,ValidationPipe} from '@nestjs/common';
import {MessagePattern,Payload, RpcException,} from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { AccountsService } from './accounts.services';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller()
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
  ) {}

  // 1. HESAP OLUŞTURMA
  @MessagePattern('createAccount')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new RpcException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Geçersiz hesap bilgileri',
          errors: errors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
          })),
        }),
    }),
  )
  async createAccount(@Payload() dto: CreateAccountDto) {
    const { username, password, role } = dto;

    // Kullanıcı adını normalize et
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Kullanıcı adı boş olamaz',
      });
    }

    // Aynı kullanıcı adı var mı?
    const existingAccount =
      await this.accountsService.findByUsername(normalizedUsername);

    if (existingAccount) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu kullanıcı adı zaten kullanılıyor',
      });
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      // Veritabanına kaydet
      const account = await this.accountsService.createAccount({
        username: normalizedUsername,
        passwordHash,
        role,
      });

      // Hash'i yanıttan çıkar
      const { passwordHash: _hash, ...safeAccount } = account;

      return safeAccount;
    } catch (error: unknown) {
      // Eşzamanlı kayıtlar için unique constraint kontrolü
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Bu kullanıcı adı zaten kullanılıyor',
        });
      }

      throw error;
    }
  }

  // 2. HESAPLARI LİSTELEME
  @MessagePattern('findAllAccounts')
  async findAllAccounts() {
    return this.accountsService.findAllAccounts();
  }

  // 3. KULLANICI BİLGİLERİNİ DOĞRULAMA
  @MessagePattern('validateCredentials')
  async validateCredentials(
    @Payload() data: { username: string; password: string },
  ) {
    const invalidCredentials = () =>
      new RpcException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Kullanıcı adı veya şifre hatalı',
      });

    if (
      !data ||
      typeof data.username !== 'string' ||
      typeof data.password !== 'string'
    ) {
      throw invalidCredentials();
    }

    const username = data.username.trim().toLowerCase();

    // Kullanıcıyı hash bilgisiyle getir
    const account =
      await this.accountsService.findByUsernameWithPassword(username);

    if (!account) {
      throw invalidCredentials();
    }

    // Şifreyi karşılaştır
    const isPasswordValid = await bcrypt.compare(
      data.password,
      account.passwordHash,
    );

  if (!isPasswordValid || !account.isActive) {
  throw invalidCredentials();
}
    // Hash'i yanıttan çıkar
    const { passwordHash: _hash, ...safeAccount } = account;

    return safeAccount;
  }
}
