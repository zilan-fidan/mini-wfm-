import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTeamsQueryDto } from './list-teams-query.dto';

const build = (input: object) => plainToInstance(ListTeamsQueryDto, input);
const check = async (input: object) => validate(build(input));

describe('ListTeamsQueryDto', () => {
  describe('varsayılanlar ve dönüşüm', () => {
    it('parametre yoksa page 1 ve limit 10 olur', async () => {
      const dto = build({});

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });

    it('metin olarak gelen page ve limit sayıya dönüştürülür', async () => {
      const dto = build({ page: '2', limit: '5' });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(5);
    });

    it('isActive "true" metni true boolean olur', () => {
      expect(build({ isActive: 'true' }).isActive).toBe(true);
    });

    it('isActive "false" metni false boolean olur', () => {
      expect(build({ isActive: 'false' }).isActive).toBe(false);
    });
  });

  describe('limit sınırları', () => {
    it.each(['1', '100'])('limit=%s geçerlidir', async (limit) => {
      expect(await check({ limit })).toHaveLength(0);
    });

    it.each(['0', '101', '500'])('limit=%s hata verir', async (limit) => {
      const errors = await check({ limit });
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('page sınırları', () => {
    it('page=1 geçerlidir', async () => {
      expect(await check({ page: '1' })).toHaveLength(0);
    });

    it.each(['0', '-1', 'abc'])('page=%s hata verir', async (page) => {
      const errors = await check({ page });
      expect(errors[0].property).toBe('page');
    });
  });

  describe('isActive', () => {
    it.each(['true', 'false'])('isActive=%s geçerlidir', async (isActive) => {
      expect(await check({ isActive })).toHaveLength(0);
    });

    it('isActive=maybe hata verir', async () => {
      const errors = await check({ isActive: 'maybe' });
      expect(errors[0].property).toBe('isActive');
    });
  });

  describe('search', () => {
    it('metin olan search geçerlidir', async () => {
      expect(await check({ search: 'back' })).toHaveLength(0);
    });
  });
});