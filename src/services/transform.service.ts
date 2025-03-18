import { injectable } from 'tsyringe';
import path from 'path';
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { Size3D } from './scene.service';

@injectable()
export class TransformService {
  private readonly modelsPath: string;
  private readonly outputPath: string;

  constructor() {
    this.modelsPath = path.join(process.cwd(), 'public', '3dpreview', 'models');
    this.outputPath = path.join(process.cwd(), 'public', 'WebAR');
  }

  /**
   * Трансформирует модель, применяя изменения размеров стелы и подставки
   */
  public async transformModel(
    modelId: string,
    stelaSize: Size3D,
    standSize: Size3D | null,
    materialName: string,
    fileName?: string
  ): Promise<string> {
    // Если передано имя файла, используем его, иначе формируем по modelId
    const inputFile = fileName || `${modelId}.glb`;
    const inputPath = path.join(this.modelsPath, inputFile);
    const timestamp = Date.now();
    const outputFileName = `${modelId}_${timestamp}.glb`;
    const outputPath = path.join(this.outputPath, 'glb', outputFileName);
    const outputDir = path.dirname(outputPath);

    try {
      console.log(`Трансформация модели ${modelId}`);
      console.log(`Входной файл: ${inputFile}`);
      console.log(`- Размер стелы: ${JSON.stringify(stelaSize)}`);
      console.log(`- Размер подставки: ${standSize ? JSON.stringify(standSize) : 'нет'}`);

      // Проверяем наличие входного файла
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Файл модели не найден: ${inputPath}`);
      }

      // Создаем директорию для вывода, если она не существует
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Загружаем GLB с помощью gltf-transform
      const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
      const document = await io.read(inputPath);
      
      // Получаем корневой узел
      const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
      if (!scene) {
        throw new Error("Сцена не найдена в модели");
      }
      
      // Находим все ноды в модели
      const nodes = document.getRoot().listNodes();
      
      // Идентифицируем стелу и подставку по имени или позиции
      // Предполагаем, что стела - это основной объект, а подставка (если есть) находится ниже
      let stelaMesh = null;
      let standMesh = null;
      
      for (const node of nodes) {
        const name = node.getName().toLowerCase();
        if (name.includes('stela') || name.includes('stella') || name.includes('стела')) {
          stelaMesh = node;
        } else if (name.includes('stand') || name.includes('подставка')) {
          standMesh = node;
        }
      }
      
      // Если не нашли по имени, пробуем найти по размеру и позиции
      if (!stelaMesh || !standMesh) {
        // Сортируем по размеру (бОльший объект обычно стела)
        const sortedBySize = [...nodes].sort((a, b) => {
          const aScale = a.getScale();
          const bScale = b.getScale();
          const aVolume = aScale[0] * aScale[1] * aScale[2];
          const bVolume = bScale[0] * bScale[1] * bScale[2];
          return bVolume - aVolume;
        });
        
        // Если не нашли стелу по имени, берем самый большой объект
        if (!stelaMesh && sortedBySize.length > 0) {
          stelaMesh = sortedBySize[0];
        }
        
        // Если нет подставки по имени, но она должна быть, ищем подходящий объект
        if (!standMesh && standSize && sortedBySize.length > 1 && stelaMesh) {
          // Подставка обычно находится ниже стелы по Y
          for (let i = 1; i < sortedBySize.length; i++) {
            const node = sortedBySize[i];
            const translation = node.getTranslation();
            // Если объект находится ниже стелы по Y, это вероятно подставка
            if (translation[1] < stelaMesh.getTranslation()[1]) {
              standMesh = node;
              break;
            }
          }
        }
      }
      
      // Применяем изменения к стеле
      if (stelaMesh) {
        console.log('Применяем размеры к стеле');
        const originalScale = stelaMesh.getScale();
        const originalTranslation = stelaMesh.getTranslation();
        
        // Рассчитываем новый масштаб для соответствия заданным размерам
        // Предполагаем, что изначальные размеры при масштабе 1 - это какой-то известный стандарт
        // Например, если при масштабе 1 высота = 1, то для высоты 80 масштаб будет 80
        // В реальности нужно будет уточнить базовые размеры модели
        const newScaleX = stelaSize.width / 40 * originalScale[0];
        const newScaleY = stelaSize.height / 80 * originalScale[1];
        const newScaleZ = stelaSize.depth / 5 * originalScale[2];
        
        stelaMesh.setScale([newScaleX, newScaleY, newScaleZ]);
        console.log(`Новый масштаб стелы: [${newScaleX}, ${newScaleY}, ${newScaleZ}]`);
      } else {
        console.warn('Стела не найдена в модели');
      }
      
      // Применяем изменения к подставке, если она есть и нужна
      if (standMesh && standSize) {
        console.log('Применяем размеры к подставке');
        const originalScale = standMesh.getScale();
        
        // Аналогично для подставки
        const newScaleX = standSize.width / 50 * originalScale[0];
        const newScaleY = standSize.height / 10 * originalScale[1];
        const newScaleZ = standSize.depth / 20 * originalScale[2];
        
        standMesh.setScale([newScaleX, newScaleY, newScaleZ]);
        console.log(`Новый масштаб подставки: [${newScaleX}, ${newScaleY}, ${newScaleZ}]`);
      } else if (standSize) {
        console.warn('Подставка указана в параметрах, но не найдена в модели');
      }
      
      // Если подставка должна быть скрыта (standSize == null), но она есть в модели
      if (!standSize && standMesh) {
        console.log('Скрываем подставку');
        standMesh.setScale([0, 0, 0]);
      }
      
      // Сохраняем модель
      await io.write(outputPath, document);
      console.log(`Модель сохранена: ${outputPath}`);
      
      return `/WebAR/glb/${outputFileName}`;
    } catch (error) {
      console.error('Ошибка при трансформации модели:', error);
      throw error;
    }
  }
} 