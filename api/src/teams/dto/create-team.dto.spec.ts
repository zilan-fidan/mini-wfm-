import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTeamDto } from './create-team.dto';

const check = async (input: object) => {
  const dto = plainToInstance(CreateTeamDto, input);
  return validate(dto);
};

describe('CreateTeamDto', () => {
  it('yalnızca name ile geçerlidir', async () => {
    expect(await check({ name: 'Backend Ekibi' })).toHaveLength(0);
  });

  it('name ve description ile geçerlidir', async () => {
    expect(
      await check({ name: 'Backend Ekibi', description: 'Açıklama' }),
    ).toHaveLength(0);
  });

  it('200 karakterlik ad geçerlidir (üst sınır)', async () => {
    expect(await check({ name: 'a'.repeat(200) })).toHaveLength(0);
  });

  it('name yoksa hata verir', async () => {
    const errors = await check({});
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('name');
  });

  it('boş ad hata verir', async () => {
    const errors = await check({ name: '' });
    expect(errors[0].property).toBe('name');
  });

  it('201 karakterlik ad hata verir', async () => {
    const errors = await check({ name: 'a'.repeat(201) });
    expect(errors[0].property).toBe('name');
  });

  it('ad sayı ise (metin değilse) hata verir', async () => {
    const errors = await check({ name: 12345 });
    expect(errors[0].property).toBe('name');
  });

  it('description sayı ise hata verir', async () => {
    const errors = await check({ name: 'Backend Ekibi', description: 123 });
    expect(errors[0].property).toBe('description');
  });
});