import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListWorkOrdersQueryDto } from './list-work-orders-query.dto';

const build = (input: object) => plainToInstance(ListWorkOrdersQueryDto, input);
const check = async (input: object) => validate(build(input));

describe('ListWorkOrdersQueryDto', () => {
  it('varsayılan sıralama createdAt desc', async () => {
    const dto = build({});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.sortBy).toBe('createdAt');
    expect(dto.sortOrder).toBe('desc');
  });

  describe('sortBy beyaz listesi', () => {
    it.each(['createdAt', 'dueAt', 'priority'])('sortBy=%s geçerlidir', async (sortBy) => {
      expect(await check({ sortBy })).toHaveLength(0);
    });

    it.each(['name;DROP TABLE team', 'name', 'id', 'createdAt DESC', '"priority"'])(
      'sortBy=%s reddedilir',
      async (sortBy) => {
        const errors = await check({ sortBy });
        expect(errors[0].property).toBe('sortBy');
      },
    );
  });

  it.each(['ASC', 'up', 'desc;--'])('sortOrder=%s reddedilir', async (sortOrder) => {
    const errors = await check({ sortOrder });
    expect(errors[0].property).toBe('sortOrder');
  });

  describe('status çoklu değer', () => {
    it('tek değer diziye çevrilir', () => {
      expect(build({ status: 'OPEN' }).status).toEqual(['OPEN']);
    });

    it('birden fazla değer kabul edilir', async () => {
      expect(await check({ status: ['OPEN', 'ASSIGNED'] })).toHaveLength(0);
    });

    it('geçersiz değer reddedilir', async () => {
      const errors = await check({ status: ['OPEN', 'WRONG'] });
      expect(errors[0].property).toBe('status');
    });
  });

  it('overdue "true" metni boolean true olur', () => {
    expect(build({ overdue: 'true' }).overdue).toBe(true);
  });
});
