import { injectable } from 'tsyringe';
import { createHash } from 'crypto';

export interface ModelParameters {
  modelId: string;
  stelaSize: {
    width: number;
    height: number;
    depth: number;
  };
  standSize?: {
    width: number;
    height: number;
    depth: number;
  } | null;
  materialName: string;
}

@injectable()
export class HashService {
  /**
   * Генерирует хеш на основе параметров модели
   * @param params Параметры модели
   * @returns Хеш, который можно использовать в имени файла
   */
  generateModelHash(params: ModelParameters): string {
    // Приводим все значения к строкам с фиксированной точностью для детерминированности
    const stelaSize = `${params.stelaSize.width.toFixed(2)}_${params.stelaSize.height.toFixed(2)}_${params.stelaSize.depth.toFixed(2)}`;
    
    let standSize = 'no_stand';
    if (params.standSize) {
      standSize = `${params.standSize.width.toFixed(2)}_${params.standSize.height.toFixed(2)}_${params.standSize.depth.toFixed(2)}`;
    }
    
    // Нормализуем имя материала
    const materialName = params.materialName.replace(/\.jpg$/i, '').toLowerCase();
    
    // Создаем строку для хеширования
    const hashString = `${params.modelId}_${stelaSize}_${standSize}_${materialName}`;
    
    // Генерируем SHA-256 хеш и берем первые 10 символов
    const hash = createHash('sha256').update(hashString).digest('hex').substring(0, 10);
    
    return hash;
  }
  
  /**
   * Создает имя файла с хешем
   * @param params Параметры модели
   * @param extension Расширение файла (без точки)
   * @returns Имя файла с хешем
   */
  generateFileName(params: ModelParameters, extension: string): string {
    const hash = this.generateModelHash(params);
    return `${params.modelId}_${hash}.${extension}`;
  }
} 