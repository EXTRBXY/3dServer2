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

  private isStelaMesh(name: string): boolean {
    return name.toLowerCase() === 'node' || name.toLowerCase() === 'other';
  }

  private isStandMesh(name: string): boolean {
    return name.toLowerCase() === 'node_stand';
  }

  private convertToMeters(size: Size3D): Size3D {
    return {
      height: parseFloat(size.height as any) / 100,
      width: parseFloat(size.width as any) / 100,
      depth: parseFloat(size.depth as any) / 100
    };
  }

  public async transformModel(
    modelId: string,
    stelaSize: Size3D,
    standSize: Size3D | null,
    materialName: string,
    fileName?: string
  ): Promise<string> {
    const inputFile = fileName || `${modelId}.glb`;
    const inputPath = path.join(this.modelsPath, inputFile);
    const timestamp = Date.now();
    const outputFileName = `${modelId}_${timestamp}.glb`;
    const outputPath = path.join(this.outputPath, 'glb', outputFileName);
    const outputDir = path.dirname(outputPath);

    try {
      // Конвертируем все размеры в метры
      const stelaSizeInMeters = this.convertToMeters(stelaSize);
      const standSizeInMeters = standSize ? this.convertToMeters(standSize) : null;

      console.log(`Трансформация модели ${modelId}`);
      console.log(`Входной файл: ${inputFile}`);
      console.log(`- Размер стелы (м): ${JSON.stringify(stelaSizeInMeters)}`);
      console.log(`- Размер подставки (м): ${standSizeInMeters ? JSON.stringify(standSizeInMeters) : 'нет'}`);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Файл модели не найден: ${inputPath}`);
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
      const document = await io.read(inputPath);
      const nodes = document.getRoot().listNodes();
      
      // Собираем все меши стелы и подставки
      const stelaMeshNodes = [];
      let standMeshNode = null;
      
      // Сохраним оригинальные данные о мешах
      const originalData = new Map();
      
      // Найдем все меши, соответствующие стеле и подставке
      for (const node of nodes) {
        const name = node.getName();
        console.log(`Нода: ${name}, имеет меш: ${node.getMesh() ? 'да' : 'нет'}`);
        
        if (node.getMesh()) {
          // Сохраняем оригинальные данные
          const originalScale = node.getScale().slice();
          const originalTranslation = node.getTranslation().slice();
          
          // Сбрасываем масштаб для измерения
          node.setScale([1, 1, 1] as [number, number, number]);
          node.setTranslation([0, 0, 0] as [number, number, number]);
          
          // Вычисляем bbox на основе меша
          const mesh = node.getMesh();
          if (mesh) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            
            // Проходим по всем примитивам меша
            for (const primitive of mesh.listPrimitives()) {
              const positions = primitive.getAttribute('POSITION');
              if (positions) {
                const positionArray = positions.getArray();
                
                // Находим минимальные и максимальные координаты
                if (positionArray && positionArray.length > 0) {
                  for (let i = 0; i < positionArray.length; i += 3) {
                    const x = positionArray[i];
                    const y = positionArray[i + 1];
                    const z = positionArray[i + 2];
                    
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    minZ = Math.min(minZ, z);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    maxZ = Math.max(maxZ, z);
                  }
                }
              }
            }
            
            const originalSize = {
              height: maxY - minY,
              width: maxX - minX,
              depth: maxZ - minZ
            };
            
            // Восстанавливаем оригинальный масштаб и позицию
            node.setScale(originalScale as [number, number, number]);
            node.setTranslation(originalTranslation as [number, number, number]);
            
            // Сохраняем в оригинальные данные
            originalData.set(node, {
              originalSize,
              originalScale,
              originalTranslation,
              center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                z: (minZ + maxZ) / 2
              }
            });
            
            console.log(`Оригинальный размер меша ${name} (м): `, originalSize);
            
            // Классифицируем меш как стела или подставка
            if (this.isStelaMesh(name)) {
              stelaMeshNodes.push(node);
              console.log(`Найден меш стелы: ${name}`);
            } else if (this.isStandMesh(name)) {
              standMeshNode = node;
              console.log(`Найден меш подставки: ${name}`);
            }
          }
        }
      }

      // Масштабируем стелу
      if (stelaMeshNodes.length > 0) {
        // Находим общий размер стелы
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const t = node.getTranslation();
            const size = data.originalSize;
            const center = data.center;
            
            minX = Math.min(minX, t[0] + center.x - size.width/2);
            minY = Math.min(minY, t[1] + center.y - size.height/2);
            minZ = Math.min(minZ, t[2] + center.z - size.depth/2);
            maxX = Math.max(maxX, t[0] + center.x + size.width/2);
            maxY = Math.max(maxY, t[1] + center.y + size.height/2);
            maxZ = Math.max(maxZ, t[2] + center.z + size.depth/2);
          }
        }
        
        const totalSize = {
          height: maxY - minY,
          width: maxX - minX,
          depth: maxZ - minZ
        };
        
        console.log('Общий размер стелы (м):', totalSize);
        
        // Вычисляем коэффициенты масштабирования (уже в метрах)
        const scaleFactors = {
          height: stelaSizeInMeters.height / totalSize.height,
          width: stelaSizeInMeters.width / totalSize.width,
          depth: stelaSizeInMeters.depth / totalSize.depth
        };
        
        console.log('Коэффициенты масштабирования стелы:', scaleFactors);

        // Применяем масштабирование ко всем мешам стелы
        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const newScale = [
              data.originalScale[0] * scaleFactors.width,
              data.originalScale[1] * scaleFactors.height,
              data.originalScale[2] * scaleFactors.depth
            ] as [number, number, number];
            
            node.setScale(newScale);
            console.log(`Новый масштаб для ${node.getName()}: [${newScale}]`);
          }
        }
      }

      // Масштабируем подставку
      if (standMeshNode && standSizeInMeters) {
        const data = originalData.get(standMeshNode);
        if (data) {
          const scaleFactors = {
            height: standSizeInMeters.height / data.originalSize.height,
            width: standSizeInMeters.width / data.originalSize.width,
            depth: standSizeInMeters.depth / data.originalSize.depth
          };
          
          console.log('Коэффициенты масштабирования подставки:', scaleFactors);
          
          const newScale = [
            data.originalScale[0] * scaleFactors.width,
            data.originalScale[1] * scaleFactors.height,
            data.originalScale[2] * scaleFactors.depth
          ] as [number, number, number];
          
          standMeshNode.setScale(newScale);
          console.log(`Новый масштаб для подставки: [${newScale}]`);
        }
      } else if (standMeshNode && !standSizeInMeters) {
        standMeshNode.setScale([0, 0, 0] as [number, number, number]);
        console.log('Подставка скрыта');
      }

      // Позиционируем стелу относительно подставки
      if (stelaMeshNodes.length > 0) {
        // Сначала центрируем все по X и Z
        for (const node of stelaMeshNodes) {
          node.setTranslation([0, 0, 0] as [number, number, number]);
        }
        if (standMeshNode) {
          standMeshNode.setTranslation([0, 0, 0] as [number, number, number]);
        }

        // Вычисляем размеры стелы после масштабирования
        let stelaMinY = Infinity;
        let stelaMaxY = -Infinity;
        
        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const s = node.getScale();
            const height = data.originalSize.height * s[1];
            const center = data.center.y * s[1];
            
            // Находим верхнюю и нижнюю точки стелы
            const top = center + height/2;
            const bottom = center - height/2;
            
            stelaMinY = Math.min(stelaMinY, bottom);
            stelaMaxY = Math.max(stelaMaxY, top);
          }
        }
        
        const stelaHeight = stelaMaxY - stelaMinY;
        console.log(`Высота стелы после масштабирования (м): ${stelaHeight}`);
        console.log(`Нижняя точка стелы (м): ${stelaMinY}`);
        console.log(`Верхняя точка стелы (м): ${stelaMaxY}`);

        if (standMeshNode && standSizeInMeters) {
          const standData = originalData.get(standMeshNode);
          if (standData) {
            const s = standMeshNode.getScale();
            const standHeight = standData.originalSize.height * s[1];
            
            // В клиенте подставка центрирована по Y, поэтому её верхняя точка = высота/2
            const standTop = standHeight/1;
            console.log(`Высота подставки (м): ${standHeight}`);
            console.log(`Верхняя точка подставки (м): ${standTop}`);
            
            // Смещаем стелу так, чтобы её нижняя точка была на верхней точке подставки
            const offsetY = standTop - stelaMinY;
            console.log(`Смещение стелы (м): ${offsetY}`);
            
            // Применяем смещение ко всем мешам стелы
            for (const node of stelaMeshNodes) {
              node.setTranslation([0, offsetY, 0] as [number, number, number]);
            }
          }
        } else {
          // Если подставки нет, ставим стелу на уровень Y=0
          const offsetY = -stelaMinY;
          console.log(`Смещение стелы без подставки (м): ${offsetY}`);
          
          for (const node of stelaMeshNodes) {
            node.setTranslation([0, offsetY, 0] as [number, number, number]);
          }
        }
      }

      await io.write(outputPath, document);
      console.log(`Модель сохранена: ${outputPath}`);

      return `/WebAR/glb/${outputFileName}`;
    } catch (error) {
      console.error('Ошибка при трансформации модели:', error);
      throw error;
    }
  }
} 