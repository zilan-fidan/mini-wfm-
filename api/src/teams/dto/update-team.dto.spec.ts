import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTeamDto } from './update-team.dto';

const check = async (input: object) => {
  const dto = plainToInstance(UpdateTeamDto, input);
  return validate(dto);
};

describe('UpdateTeamDto', () => {
  it('boş obje geçerlidir (tüm alanlar opsiyonel)', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('yalnızca description ile geçerlidir', async () => {
    expect(await check({ description: 'Yeni' })).toHaveLength(0);
  });

  it('isActive false ile geçerlidir', async () => {
    expect(await check({ isActive: false })).toHaveLength(0);
  });

  it('boş name hata verir', async () => {
    const errors = await check({ name: '' });
    expect(errors[0].property).toBe('name');
  });

  it('201 karakterlik name hata verir', async () => {
    const errors = await check({ name: 'a'.repeat(201) });
    expect(errors[0].property).toBe('name');
  });

  it('isActive boolean değilse hata verir', async () => {
    const errors = await check({ isActive: 'evet' });
    expect(errors[0].property).toBe('isActive');
  });
});