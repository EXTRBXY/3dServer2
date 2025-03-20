import { injectable } from 'tsyringe';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@injectable()
export class USDZService {
  private readonly outputPath: string;
  private readonly dockerImage = 'marlon360/usd-from-gltf:latest';

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

      // Подготавливаем пути для Docker
      const inputDir = path.dirname(absoluteGlbPath);
      const dockerCmd = `docker run --rm -v "${inputDir}:/usr/src/input" -v "${this.outputPath}:/usr/src/output" ${this.dockerImage} /usr/src/input/${glbFileName} /usr/src/output/${usdzFileName}`;
      
      console.log('Запуск Docker конвертера:', dockerCmd);
      
      // Выполняем конвертацию через Docker
      const { stdout, stderr } = await execPromise(dockerCmd);
      
      if (stderr) {
        console.error('Ошибка при конвертации:', stderr);
      }
      
      if (stdout) {
        console.log('Результат конвертации:', stdout);
      }

      // Проверяем, создался ли файл
      if (fs.existsSync(usdzFilePath)) {
        console.log(`USDZ файл успешно создан: ${usdzFilePath}`);
        return `/WebAR/usdz/${usdzFileName}`;
      } else {
        console.error('USDZ файл не был создан');
        return null;
      }

    } catch (error) {
      console.error('Ошибка в USDZService.convertToUSDZ:', error);
      return null;
    }
  }
} 