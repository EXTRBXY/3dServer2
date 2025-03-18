import { injectable } from 'tsyringe';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

@injectable()
export class UsdzService {
  private readonly outputPath: string;

  constructor() {
    this.outputPath = path.join(process.cwd(), 'public', 'WebAR');
  }

  /**
   * Конвертирует GLB файл в USDZ формат
   * @param glbPath Путь к GLB файлу
   * @returns Путь к сгенерированному USDZ файлу
   */
  public async convertGlbToUsdz(glbPath: string): Promise<string> {
    try {
      console.log(`Конвертация GLB в USDZ: ${glbPath}`);
      
      // Проверка наличия исходного файла
      if (!fs.existsSync(glbPath)) {
        throw new Error(`Исходный GLB файл не найден: ${glbPath}`);
      }
      
      // Создание пути для выходного файла
      const glbFileName = path.basename(glbPath);
      const usdzFileName = glbFileName.replace('.glb', '.usdz');
      const usdzPath = path.join(this.outputPath, 'usdz', usdzFileName);
      
      // Убедимся, что директория для USDZ существует
      const usdzDir = path.dirname(usdzPath);
      if (!fs.existsSync(usdzDir)) {
        fs.mkdirSync(usdzDir, { recursive: true });
      }
      
      // Формируем команду для конвертации
      await this.executeConversion(glbPath, usdzPath);
      
      // Проверяем, что файл был создан
      if (!fs.existsSync(usdzPath)) {
        throw new Error(`Не удалось создать USDZ файл: ${usdzPath}`);
      }
      
      console.log(`USDZ файл успешно создан: ${usdzPath}`);
      return `/WebAR/usdz/${usdzFileName}`;
    } catch (error) {
      console.error('Ошибка при конвертации GLB в USDZ:', error);
      throw error;
    }
  }

  /**
   * Выполняет команду для конвертации GLB в USDZ
   * Метод выбирает наиболее подходящий инструмент для конвертации
   */
  private async executeConversion(glbPath: string, usdzPath: string): Promise<void> {
    try {
      // Попытка использовать usd_from_gltf (Google), если доступен
      try {
        const cmd = `usd_from_gltf "${glbPath}" "${usdzPath}"`;
        console.log(`Выполнение команды: ${cmd}`);
        await execPromise(cmd);
        return;
      } catch (error) {
        console.log('usd_from_gltf не доступен, пробуем альтернативный метод...');
      }

      // Альтернативный способ через gltf2usdz, если установлен
      try {
        const cmd = `gltf2usdz "${glbPath}" "${usdzPath}"`;
        console.log(`Выполнение команды: ${cmd}`);
        await execPromise(cmd);
        return;
      } catch (error) {
        console.log('gltf2usdz не доступен, пробуем последний метод...');
      }

      // Если предыдущие методы не сработали, выбрасываем ошибку
      throw new Error('Не найдены инструменты для конвертации GLB в USDZ. Установите usd_from_gltf или gltf2usdz.');
    } catch (error) {
      console.error('Ошибка при выполнении конвертации:', error);
      throw error;
    }
  }
} 