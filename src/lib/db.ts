import Dexie, { type Table } from 'dexie';
import { CitizenRecord, AppSettings } from '@/types/citizen';

export class CitizenDatabase extends Dexie {
  citizens!: Table<CitizenRecord, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('DCCFormV2DB');
    
    // Khai báo schema, các trường được index
    this.version(1).stores({
      citizens: '++id, &idNumber, fullNameNormalized, status, createdAt',
      settings: '++id'
    });
  }

  // Helper tìm kiếm công dân theo idNumber
  async findByIdNumber(idNumber: string): Promise<CitizenRecord | undefined> {
    if (!idNumber) return undefined;
    return await this.citizens.where('idNumber').equals(idNumber).first();
  }
}

export const db = new CitizenDatabase();
