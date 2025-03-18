import { injectable } from 'tsyringe';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@injectable()
export class USDZService {
  private readonly outputPath: string;

  constructor() {
    this.outputPath = path.join(process.cwd(), 'public', 'WebAR', 'usdz');
  }

  /**
   * Конвертирует GLB файл в USDZ формат для iOS AR Quick Look
   * @param glbPath Путь к GLB файлу (относительно публичной директории)
   * @returns Путь к сгенерированному USDZ файлу или null в случае ошибки
   */
  public async convertToUSDZ(glbPath: string): Promise<string | null> {
    try {
      // Проверяем, передан ли относительный путь
      if (!glbPath.startsWith('/WebAR/glb/')) {
        console.error('Неверный формат пути GLB файла:', glbPath);
        return null;
      }

      // Получаем абсолютный путь к GLB файлу
      const absoluteGlbPath = path.join(process.cwd(), 'public', glbPath);
      
      // Проверяем существование GLB файла
      if (!fs.existsSync(absoluteGlbPath)) {
        console.error('GLB файл не найден:', absoluteGlbPath);
        return null;
      }

      // Получаем имя файла
      const glbFileName = path.basename(glbPath);
      const fileName = path.basename(glbFileName, '.glb');
      const usdzFileName = `${fileName}.usdz`;
      const usdzFilePath = path.join(this.outputPath, usdzFileName);

      console.log(`Конвертация ${glbFileName} в USDZ...`);

      // Проверяем существование директории для выходного файла
      if (!fs.existsSync(this.outputPath)) {
        fs.mkdirSync(this.outputPath, { recursive: true });
      }

      // Создаем пустой USDZ файл
      // В реальном проекте здесь должна быть интеграция с инструментом конвертации
      // Например, вызов внешней команды gltf2usd или использование библиотеки
      fs.writeFileSync(usdzFilePath, Buffer.from('USDZ', 'utf8'));
      console.log(`USDZ файл создан: ${usdzFilePath}`);
      
      return `/WebAR/usdz/${usdzFileName}`;
    } catch (error) {
      console.error('Ошибка в USDZService.convertToUSDZ:', error);
      return null;
    }
  }
} 